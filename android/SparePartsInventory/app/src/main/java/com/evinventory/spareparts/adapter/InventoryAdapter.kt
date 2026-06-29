package com.evinventory.spareparts.adapter

import android.view.LayoutInflater
import android.view.ViewGroup
import androidx.recyclerview.widget.DiffUtil
import androidx.recyclerview.widget.ListAdapter
import androidx.recyclerview.widget.RecyclerView
import com.evinventory.spareparts.databinding.ItemInventoryBinding
import com.evinventory.spareparts.model.InventoryItem

class InventoryAdapter(
    private val onItemClick: (InventoryItem) -> Unit
) : ListAdapter<InventoryItem, InventoryAdapter.ViewHolder>(DiffCallback()) {

    override fun onCreateViewHolder(parent: ViewGroup, viewType: Int): ViewHolder {
        val binding = ItemInventoryBinding.inflate(
            LayoutInflater.from(parent.context), parent, false
        )
        return ViewHolder(binding)
    }

    override fun onBindViewHolder(holder: ViewHolder, position: Int) {
        holder.bind(getItem(position))
    }

    inner class ViewHolder(
        private val binding: ItemInventoryBinding
    ) : RecyclerView.ViewHolder(binding.root) {

        fun bind(item: InventoryItem) {
            binding.textItemCode.text = item.itemCode
            binding.textDescription.text = item.itemDescription
            binding.textQty.text = item.qty.toString()
            binding.root.setOnClickListener { onItemClick(item) }
        }
    }

    private class DiffCallback : DiffUtil.ItemCallback<InventoryItem>() {
        override fun areItemsTheSame(a: InventoryItem, b: InventoryItem) = a.id == b.id
        override fun areContentsTheSame(a: InventoryItem, b: InventoryItem) = a == b
    }
}
