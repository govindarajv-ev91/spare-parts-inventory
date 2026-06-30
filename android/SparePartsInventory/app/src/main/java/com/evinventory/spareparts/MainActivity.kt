package com.evinventory.spareparts

import android.content.Intent
import android.os.Bundle
import android.view.View
import android.widget.ArrayAdapter
import android.widget.Toast
import androidx.appcompat.app.AlertDialog
import androidx.appcompat.app.AppCompatActivity
import androidx.lifecycle.lifecycleScope
import com.evinventory.spareparts.databinding.ActivityMainBinding
import com.evinventory.spareparts.network.SupabaseClient
import kotlinx.coroutines.launch

class MainActivity : AppCompatActivity() {

    private lateinit var binding: ActivityMainBinding
    private var hubs: List<String> = emptyList()

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        binding = ActivityMainBinding.inflate(layoutInflater)
        setContentView(binding.root)

        loadHubs()

        binding.buttonContinue.setOnClickListener {
            val selected = binding.spinnerHub.selectedItem?.toString()
            if (selected.isNullOrBlank() || selected == getString(R.string.select_hub_hint)) {
                Toast.makeText(this, R.string.please_select_hub, Toast.LENGTH_SHORT).show()
                return@setOnClickListener
            }
            confirmHubAndContinue(selected)
        }

        binding.buttonRefresh.setOnClickListener { loadHubs() }
    }

    private fun confirmHubAndContinue(hubName: String) {
        AlertDialog.Builder(this)
            .setTitle(R.string.confirm_hub_title)
            .setMessage(getString(R.string.confirm_hub_message, hubName))
            .setPositiveButton(R.string.confirm_yes) { _, _ ->
                startActivity(Intent(this, InventoryActivity::class.java).apply {
                    putExtra(InventoryActivity.EXTRA_HUB_NAME, hubName)
                })
            }
            .setNegativeButton(R.string.cancel, null)
            .show()
    }

    private fun loadHubs() {
        binding.progressBar.visibility = View.VISIBLE
        binding.buttonContinue.isEnabled = false
        binding.textStatus.text = getString(R.string.loading_hubs)

        lifecycleScope.launch {
            val result = SupabaseClient.fetchHubNames()
            binding.progressBar.visibility = View.GONE

            result.onSuccess { list ->
                hubs = list
                if (list.isEmpty()) {
                    binding.textStatus.text = getString(R.string.no_hubs_found)
                    setupSpinner(emptyList())
                } else {
                    binding.textStatus.text = getString(R.string.hubs_loaded, list.size)
                    setupSpinner(list)
                    binding.buttonContinue.isEnabled = true
                }
            }.onFailure { e ->
                binding.textStatus.text = e.message ?: getString(R.string.error_generic)
                Toast.makeText(this@MainActivity, e.message, Toast.LENGTH_LONG).show()
            }
        }
    }

    private fun setupSpinner(list: List<String>) {
        val items = mutableListOf(getString(R.string.select_hub_hint))
        items.addAll(list)
        val adapter = ArrayAdapter(this, android.R.layout.simple_spinner_item, items)
        adapter.setDropDownViewResource(android.R.layout.simple_spinner_dropdown_item)
        binding.spinnerHub.adapter = adapter
    }
}
