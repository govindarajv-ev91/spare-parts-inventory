package com.evinventory.spareparts

import com.evinventory.spareparts.network.SupabaseClient
import com.google.mlkit.vision.text.Text

object PlateTextExtractor {

    private val INDIAN_PLATE = Regex(
        """[A-Z]{2}\s?\d{1,2}\s?[A-Z]{1,3}\s?\d{3,4}""",
        RegexOption.IGNORE_CASE
    )

    fun extractFromVisionText(visionText: Text): String? {
        extractPlate(visionText.text)?.let { return it }

        for (block in visionText.textBlocks) {
            extractPlate(block.text)?.let { return it }
            for (line in block.lines) {
                extractPlate(line.text)?.let { return it }
                for (element in line.elements) {
                    extractPlate(element.text)?.let { return it }
                }
            }
        }
        return null
    }

    fun extractPlate(raw: String): String? {
        val upper = raw.uppercase()

        INDIAN_PLATE.find(upper)?.value?.let { match ->
            val normalized = SupabaseClient.normalizeVehicle(match)
            if (normalized.length >= 10) return normalized
        }

        val compact = upper.replace(Regex("[^A-Z0-9]"), "")
        if (compact.length >= 10) {
            INDIAN_PLATE.find(compact)?.value?.let { match ->
                val normalized = SupabaseClient.normalizeVehicle(match)
                if (normalized.length >= 10) return normalized
            }
            if (compact.length in 10..12) return compact
        }

        upper.split(Regex("[\\s\\-]+")).forEach { token ->
            val normalized = SupabaseClient.normalizeVehicle(token)
            if (normalized.length >= 10) return normalized
        }

        return null
    }
}
