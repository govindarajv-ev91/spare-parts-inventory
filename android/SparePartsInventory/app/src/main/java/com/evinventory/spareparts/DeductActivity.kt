package com.evinventory.spareparts

import android.os.Bundle
import android.view.View
import android.widget.Toast
import androidx.activity.result.contract.ActivityResultContracts
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
    }

    private lateinit var binding: ActivityDeductBinding
    private var itemCode = ""
    private var hubName = ""
    private var availableQty = 0

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

        binding.buttonSave.setOnClickListener { saveDeduction() }
        binding.buttonScanPlate.setOnClickListener {
            scanPlateLauncher.launch(android.content.Intent(this, PlateScanActivity::class.java))
        }
    }

    override fun onSupportNavigateUp(): Boolean {
        finish()
        return true
    }

    private fun saveDeduction() {
        val qtyStr = binding.editQty.text?.toString()?.trim().orEmpty()
        val vehicle = binding.editVehicle.text?.toString()?.trim().orEmpty()

        if (qtyStr.isEmpty()) {
            binding.editQty.error = getString(R.string.enter_qty)
            return
        }

        val qty = qtyStr.toIntOrNull()
        if (qty == null || qty <= 0) {
            binding.editQty.error = getString(R.string.invalid_qty)
            return
        }

        if (qty > availableQty) {
            binding.editQty.error = getString(R.string.insufficient_stock, availableQty)
            return
        }

        if (vehicle.isEmpty()) {
            binding.editVehicle.error = getString(R.string.enter_vehicle)
            return
        }

        // Validate format then check vehicle_master
        val normalized = SupabaseClient.normalizeVehicle(vehicle)
        if (normalized.length <= 9) {
            binding.editVehicle.error = getString(R.string.vehicle_min_length)
            return
        }

        binding.progressBar.visibility = View.VISIBLE
        binding.buttonSave.isEnabled = false

        lifecycleScope.launch {
            val validResult = SupabaseClient.validateVehicle(normalized)
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

            val result = SupabaseClient.deductStock(itemCode, hubName, qty, normalized)
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
