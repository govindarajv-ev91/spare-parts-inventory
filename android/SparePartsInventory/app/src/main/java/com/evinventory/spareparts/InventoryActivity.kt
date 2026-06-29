package com.evinventory.spareparts

import android.content.Intent
import android.os.Bundle
import android.view.View
import android.widget.Toast
import androidx.appcompat.app.AppCompatActivity
import androidx.appcompat.widget.SearchView
import androidx.lifecycle.lifecycleScope
import androidx.recyclerview.widget.LinearLayoutManager
import com.evinventory.spareparts.adapter.InventoryAdapter
import com.evinventory.spareparts.databinding.ActivityInventoryBinding
import com.evinventory.spareparts.model.InventoryItem
import com.evinventory.spareparts.network.SupabaseClient
import kotlinx.coroutines.launch

class InventoryActivity : AppCompatActivity() {

    companion object {
        const val EXTRA_HUB_NAME = "hub_name"
    }

    private lateinit var binding: ActivityInventoryBinding
    private lateinit var adapter: InventoryAdapter
    private var hubName: String = ""
    private var allItems: List<InventoryItem> = emptyList()

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        binding = ActivityInventoryBinding.inflate(layoutInflater)
        setContentView(binding.root)

        hubName = intent.getStringExtra(EXTRA_HUB_NAME) ?: ""
        supportActionBar?.title = hubName
        supportActionBar?.setDisplayHomeAsUpEnabled(true)

        adapter = InventoryAdapter { item ->
            startActivity(Intent(this, DeductActivity::class.java).apply {
                putExtra(DeductActivity.EXTRA_ITEM_ID, item.id)
                putExtra(DeductActivity.EXTRA_ITEM_CODE, item.itemCode)
                putExtra(DeductActivity.EXTRA_ITEM_DESC, item.itemDescription)
                putExtra(DeductActivity.EXTRA_QTY, item.qty)
                putExtra(DeductActivity.EXTRA_HUB_NAME, hubName)
            })
        }

        binding.recyclerView.layoutManager = LinearLayoutManager(this)
        binding.recyclerView.adapter = adapter

        binding.searchView.setOnQueryTextListener(object : SearchView.OnQueryTextListener {
            override fun onQueryTextSubmit(query: String?) = false
            override fun onQueryTextChange(newText: String?): Boolean {
                filterList(newText.orEmpty())
                return true
            }
        })

        binding.buttonRefresh.setOnClickListener { loadInventory() }
        loadInventory()
    }

    override fun onSupportNavigateUp(): Boolean {
        finish()
        return true
    }

    override fun onResume() {
        super.onResume()
        if (allItems.isNotEmpty()) loadInventory()
    }

    private fun loadInventory() {
        binding.progressBar.visibility = View.VISIBLE
        binding.textEmpty.visibility = View.GONE

        lifecycleScope.launch {
            val result = SupabaseClient.fetchInventoryByHub(hubName)
            binding.progressBar.visibility = View.GONE

            result.onSuccess { items ->
                allItems = items
                filterList(binding.searchView.query?.toString().orEmpty())
            }.onFailure { e ->
                Toast.makeText(this@InventoryActivity, e.message, Toast.LENGTH_LONG).show()
                binding.textEmpty.visibility = View.VISIBLE
                binding.textEmpty.text = e.message
            }
        }
    }

    private fun filterList(query: String) {
        val q = query.trim().lowercase()
        val filtered = if (q.isEmpty()) {
            allItems
        } else {
            allItems.filter {
                it.itemCode.lowercase().contains(q) ||
                    it.itemDescription.lowercase().contains(q)
            }
        }
        adapter.submitList(filtered)
        binding.textEmpty.visibility = if (filtered.isEmpty()) View.VISIBLE else View.GONE
        binding.textEmpty.text = if (allItems.isEmpty()) {
            getString(R.string.no_items_in_hub)
        } else {
            getString(R.string.no_search_results)
        }
    }
}
