package com.evinventory.spareparts.network

import com.evinventory.spareparts.BuildConfig
import com.evinventory.spareparts.model.InventoryItem
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import org.json.JSONArray
import org.json.JSONObject
import java.net.URLEncoder
import java.util.concurrent.TimeUnit

object SupabaseClient {

    fun normalizeVehicle(raw: String): String =
        raw.trim().uppercase().replace(Regex("[\\s\\-]"), "")

    private val client = OkHttpClient.Builder()
        .connectTimeout(30, TimeUnit.SECONDS)
        .readTimeout(30, TimeUnit.SECONDS)
        .build()

    private val jsonMedia = "application/json".toMediaType()

    private fun baseUrl() = BuildConfig.SUPABASE_URL.trimEnd('/')

    private fun headers(): Map<String, String> = mapOf(
        "apikey" to BuildConfig.SUPABASE_ANON_KEY,
        "Authorization" to "Bearer ${BuildConfig.SUPABASE_ANON_KEY}",
        "Content-Type" to "application/json"
    )

    suspend fun fetchHubNames(): Result<List<String>> = withContext(Dispatchers.IO) {
        runCatching {
            val url = "${baseUrl()}/rest/v1/inventory?select=hub_name&order=hub_name"
            val request = Request.Builder()
                .url(url)
                .apply { headers().forEach { (k, v) -> addHeader(k, v) } }
                .get()
                .build()

            val response = client.newCall(request).execute()
            val body = response.body?.string() ?: throw Exception("Empty response")

            if (!response.isSuccessful) {
                throw Exception(parseError(body) ?: "Failed to load hubs (${response.code})")
            }

            val arr = JSONArray(body)
            val hubs = linkedSetOf<String>()
            for (i in 0 until arr.length()) {
                hubs.add(arr.getJSONObject(i).getString("hub_name"))
            }
            hubs.toList()
        }
    }

    suspend fun fetchInventoryByHub(hubName: String): Result<List<InventoryItem>> =
        withContext(Dispatchers.IO) {
            runCatching {
                val encoded = URLEncoder.encode(hubName, "UTF-8").replace("+", "%20")
                val url =
                    "${baseUrl()}/rest/v1/inventory?hub_name=eq.$encoded&select=*&order=item_code"
                val request = Request.Builder()
                    .url(url)
                    .apply { headers().forEach { (k, v) -> addHeader(k, v) } }
                    .get()
                    .build()

                val response = client.newCall(request).execute()
                val body = response.body?.string() ?: throw Exception("Empty response")

                if (!response.isSuccessful) {
                    throw Exception(parseError(body) ?: "Failed to load inventory (${response.code})")
                }

                val arr = JSONArray(body)
                buildList {
                    for (i in 0 until arr.length()) {
                        add(InventoryItem.fromJson(arr.getJSONObject(i)))
                    }
                }
            }
        }

    suspend fun validateVehicle(vehicleNumber: String): Result<Boolean> =
        withContext(Dispatchers.IO) {
            runCatching {
                val normalized = normalizeVehicle(vehicleNumber)
                val encoded = URLEncoder.encode(normalized, "UTF-8").replace("+", "%20")

                // Exact match on vehicle_number (your master table column)
                val url =
                    "${baseUrl()}/rest/v1/vehicle_master?vehicle_number=eq.$encoded&select=vehicle_number&limit=1"

                val request = Request.Builder()
                    .url(url)
                    .apply { headers().forEach { (k, v) -> addHeader(k, v) } }
                    .addHeader("Accept", "application/json")
                    .get()
                    .build()

                val response = client.newCall(request).execute()
                val body = response.body?.string() ?: throw Exception("Empty response")

                if (!response.isSuccessful) {
                    throw Exception(parseError(body) ?: "Failed to validate vehicle (${response.code})")
                }

                JSONArray(body).length() > 0
            }
        }

    suspend fun deductStock(
        itemCode: String,
        hubName: String,
        qtyUsed: Int,
        vehicleNumber: String
    ): Result<Int> = withContext(Dispatchers.IO) {
        runCatching {
            val payload = JSONObject().apply {
                put("p_item_code", itemCode)
                put("p_hub_name", hubName)
                put("p_qty_used", qtyUsed)
                put("p_vehicle_number", vehicleNumber.trim())
            }

            val request = Request.Builder()
                .url("${baseUrl()}/rest/v1/rpc/deduct_stock")
                .apply { headers().forEach { (k, v) -> addHeader(k, v) } }
                .post(payload.toString().toRequestBody(jsonMedia))
                .build()

            val response = client.newCall(request).execute()
            val body = response.body?.string() ?: throw Exception("Empty response")

            if (!response.isSuccessful) {
                throw Exception(parseError(body) ?: "Failed to save (${response.code})")
            }

            val result = JSONObject(body)
            result.getInt("qty_after")
        }
    }

    private fun parseError(body: String): String? {
        return try {
            val obj = JSONObject(body)
            obj.optString("message").takeIf { it.isNotBlank() }
                ?: obj.optString("error").takeIf { it.isNotBlank() }
                ?: obj.optString("hint").takeIf { it.isNotBlank() }
        } catch (_: Exception) {
            body.takeIf { it.length < 200 }
        }
    }
}
