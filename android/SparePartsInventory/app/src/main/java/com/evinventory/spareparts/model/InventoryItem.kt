package com.evinventory.spareparts.model

import org.json.JSONObject

data class InventoryItem(
    val id: String,
    val itemCode: String,
    val itemDescription: String,
    val qty: Int,
    val city: String,
    val hubName: String
) {
    companion object {
        fun fromJson(obj: JSONObject) = InventoryItem(
            id = obj.getString("id"),
            itemCode = obj.getString("item_code"),
            itemDescription = obj.getString("item_description"),
            qty = obj.getInt("qty"),
            city = obj.getString("city"),
            hubName = obj.getString("hub_name")
        )
    }
}
