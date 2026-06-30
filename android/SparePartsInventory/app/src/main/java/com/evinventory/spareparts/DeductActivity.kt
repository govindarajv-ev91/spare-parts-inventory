package com.evinventory.spareparts

import android.os.Bundle
import android.view.View
import android.widget.Toast
import androidx.activity.result.contract.ActivityResultContracts
import androidx.appcompat.app.AlertDialog
import androidx.appcompat.app.AppCompatActivity
import androidx.lifecycle.lifecycleScope
import com.evinventory.spareparts.databinding.ActivityDeductBinding
import com.evinventory.spareparts.network.SupabaseClient
import kotlinx.coroutines.launch

class DeductActivity : AppCompatActivity() {

    companion object {
        const val EXTRA_ITEM_ID = "item_id"
        const val EXTRA_ITEM_CODE = "item_code"
        const val EXTRA_ITEM_DESC = "item_desc"
        const val EXTRA_QTY = "qty"
        const val EXTRA_HUB_NAME = "hub_name"
        private const val HIGH_QTY_THRESHOLD = 5
    }

    private lateinit var binding: ActivityDeductBinding
    private var itemCode = ""
    private var hubName = ""
    private var availableQty = 0
    private var selectedQty = 1

    private val scanPlateLauncher = registerForActivityResult(
        ActivityResultContracts.StartActivityForResult()
    ) { result ->
        if (result.resultCode == RESULT_OK) {
            val plate = result.data?.getStringExtra(PlateScanActivity.EXTRA_VEHICLE)
            if (!plate.isNullOrBlank()) {
                binding.editVehicle.setText(plate)
                binding.editVehicle.error = null
            }
        }
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        binding = ActivityDeductBinding.inflate(layoutInflater)
        setContentView(binding.root)

        itemCode = intent.getStringExtra(EXTRA_ITEM_CODE) ?: ""
        hubName = intent.getStringExtra(EXTRA_HUB_NAME) ?: ""
        availableQty = intent.getIntExtra(EXTRA_QTY, 0)
        val description = intent.getStringExtra(EXTRA_ITEM_DESC) ?: ""

        supportActionBar?.title = getString(R.string.deduct_stock)
        supportActionBar?.setDisplayHomeAsUpEnabled(true)

        binding.textItemCode.text = itemCode
        binding.textDescription.text = description
        binding.textAvailableQty.text = availableQty.toString()
        binding.textHub.text = hubName

        setupQtyStepper()

        binding.buttonSave.setOnClickListener { validateAndConfirm() }
        binding.buttonScanPlate.setOnClickListener {
            scanPlateLauncher.launch(android.content.Intent(this, PlateScanActivity::class.java))
        }
    }

    private fun setupQtyStepper() {
        selectedQty = if (availableQty > 0) 1 else 0
        updateQtyDisplay()

        binding.buttonQtyMinus.setOnClickListener {
            if (selectedQty <= 1) {
                Toast.makeText(this, R.string.qty_min_reached, Toast.LENGTH_SHORT).show()
                return@setOnClickListener
            }
            selectedQty--
            updateQtyDisplay()
        }

        binding.buttonQtyPlus.setOnClickListener {
            if (selectedQty >= availableQty) {
                Toast.makeText(this, R.string.qty_max_reached, Toast.LENGTH_SHORT).show()
                return@setOnClickListener
            }
            selectedQty++
            updateQtyDisplay()
        }
    }

    private fun updateQtyDisplay() {
        binding.textQty.text = selectedQty.toString()
        binding.textQtyHint.text = getString(R.string.qty_of_available, selectedQty, availableQty)
        binding.buttonQtyMinus.isEnabled = selectedQty > 1
        binding.buttonQtyPlus.isEnabled = selectedQty < availableQty && availableQty > 0
        binding.buttonSave.isEnabled = availableQty > 0 && selectedQty > 0
    }

    override fun onSupportNavigateUp(): Boolean {
        finish()
        return true
    }

    private fun validateAndConfirm() {
        val vehicle = binding.editVehicle.text?.toString()?.trim().orEmpty()

        if (selectedQty <= 0) {
            Toast.makeText(this, R.string.enter_qty, Toast.LENGTH_SHORT).show()
            return
        }

        if (selectedQty > availableQty) {
            Toast.makeText(this, getString(R.string.insufficient_stock, availableQty), Toast.LENGTH_SHORT).show()
            return
        }

        if (vehicle.isEmpty()) {
            binding.editVehicle.error = getString(R.string.enter_vehicle)
            return
        }

        val normalized = SupabaseClient.normalizeVehicle(vehicle)
        if (normalized.length <= 9) {
            binding.editVehicle.error = getString(R.string.vehicle_min_length)
            return
        }

        showSaveConfirmation(selectedQty, normalized)
    }

    private fun showSaveConfirmation(qty: Int, vehicle: String) {
        val message = buildString {
            append(getString(R.string.confirm_save_message, qty, itemCode, hubName, vehicle))
            if (qty >= HIGH_QTY_THRESHOLD || (availableQty > 0 && qty.toFloat() / availableQty >= 0.5f)) {
                append("\n\n")
                append(getString(R.string.confirm_save_qty_warning, qty, availableQty))
            }
        }

        AlertDialog.Builder(this)
            .setTitle(R.string.confirm_save_title)
            .setMessage(message)
            .setPositiveButton(R.string.confirm_yes) { _, _ ->
                performSave(qty, vehicle)
            }
            .setNegativeButton(R.string.cancel, null)
            .show()
    }

    private fun performSave(qty: Int, vehicle: String) {
        binding.progressBar.visibility = View.VISIBLE
        binding.buttonSave.isEnabled = false

        lifecycleScope.launch {
            val validResult = SupabaseClient.validateVehicle(vehicle)
            validResult.onFailure { e ->
                binding.progressBar.visibility = View.GONE
                binding.buttonSave.isEnabled = true
                Toast.makeText(this@DeductActivity, e.message, Toast.LENGTH_LONG).show()
                return@launch
            }

            if (validResult.getOrNull() != true) {
                binding.progressBar.visibility = View.GONE
                binding.buttonSave.isEnabled = true
                binding.editVehicle.error = getString(R.string.vehicle_not_in_master)
                Toast.makeText(this@DeductActivity, R.string.vehicle_not_in_master, Toast.LENGTH_LONG).show()
                return@launch
            }

            val result = SupabaseClient.deductStock(itemCode, hubName, qty, vehicle)
            binding.progressBar.visibility = View.GONE
            binding.buttonSave.isEnabled = true

            result.onSuccess { newQty ->
                Toast.makeText(
                    this@DeductActivity,
                    getString(R.string.saved_success, newQty),
                    Toast.LENGTH_LONG
                ).show()
                setResult(RESULT_OK)
                finish()
            }.onFailure { e ->
                Toast.makeText(this@DeductActivity, e.message, Toast.LENGTH_LONG).show()
            }
        }
    }
}
