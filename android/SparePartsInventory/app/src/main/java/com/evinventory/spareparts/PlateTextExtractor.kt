package com.evinventory.spareparts

import android.graphics.Rect
import com.google.mlkit.vision.text.Text
import kotlin.math.abs

object PlateTextExtractor {

    private val STRICT_PLATE = Regex("""^[A-Z]{2}\d{2}[A-Z]{1,3}\d{4}$""")

    private val INDIAN_STATE_CODES = setOf(
        "AN", "AP", "AR", "AS", "BR", "CG", "CH", "CT", "DD", "DL", "GA", "GJ", "HP", "HR",
        "JH", "JK", "KA", "KL", "LA", "LD", "MH", "ML", "MN", "MP", "MZ", "NL", "OD", "OR",
        "PB", "PY", "RJ", "SK", "TN", "TR", "TS", "UK", "UP", "WB"
    )

    fun extractFromVisionText(
        visionText: Text,
        imageWidth: Int = 0,
        imageHeight: Int = 0
    ): String? {
        val candidates = linkedSetOf<String>()

        tryCombineLines(visionText, imageWidth, imageHeight)?.let { candidates.add(it) }

        for (block in visionText.textBlocks) {
            if (!isInScanRegion(block.boundingBox, imageWidth, imageHeight)) continue
            collectTexts(block.text)?.let { candidates.add(it) }
            for (line in block.lines) {
                if (!isInScanRegion(line.boundingBox, imageWidth, imageHeight)) continue
                collectTexts(line.text)?.let { candidates.add(it) }
                for (element in line.elements) {
                    if (!isInScanRegion(element.boundingBox, imageWidth, imageHeight)) continue
                    collectTexts(element.text)?.let { candidates.add(it) }
                }
            }
        }

        if (candidates.isEmpty()) {
            collectTexts(visionText.text)?.let { candidates.add(it) }
        }

        return candidates
            .mapNotNull { extractPlate(it) }
            .maxByOrNull { scorePlate(it) }
    }

    private fun tryCombineLines(
        visionText: Text,
        imageWidth: Int,
        imageHeight: Int
    ): String? {
        val lines = visionText.textBlocks
            .flatMap { it.lines }
            .filter { isInScanRegion(it.boundingBox, imageWidth, imageHeight) }
            .sortedBy { it.boundingBox?.top ?: 0 }
            .map { compact(it.text) }
            .filter { it.length in 2..8 }

        for (i in 0 until lines.size - 1) {
            val top = lines[i]
            val bottom = lines[i + 1]
            extractPlate(top + bottom)?.let { return it }
            extractPlate(top + bottom.takeLast(minOf(6, bottom.length)))?.let { return it }
        }
        return null
    }

    private fun collectTexts(raw: String): String? {
        val trimmed = raw.trim()
        return trimmed.takeIf { it.isNotEmpty() }
    }

    fun extractPlate(raw: String): String? {
        val compact = compact(raw)
        if (compact.length !in 8..14) return null
        if (compact.first().isDigit()) return null

        correctToPlate(compact)?.let { return it }

        val embedded = Regex("""[A-Z]{2}[A-Z0-9]{7,11}""")
        for (match in embedded.findAll(compact)) {
            correctToPlate(match.value)?.let { return it }
        }
        return null
    }

    private fun correctToPlate(compact: String): String? {
        val candidates = linkedSetOf<String>()

        for (len in listOf(11, 10, 12, 9)) {
            if (compact.length < len) continue
            collectValidPlates(compact.take(len), candidates)
        }

        return candidates.maxByOrNull { scorePlate(it) }
    }

    private fun collectValidPlates(slice: String, out: MutableSet<String>) {
        applyPositionalCorrection(slice)?.let { out.add(it) }
        for (variant in generateCorrectionVariants(slice)) {
            applyPositionalCorrection(variant)?.let { out.add(it) }
        }
    }

    private fun applyPositionalCorrection(raw: String): String? {
        val groups = splitPlateGroups(raw) ?: return null
        val state = groups.state.map { fixLetter(it) }.joinToString("")
        val district = districtCandidates(groups.district).firstOrNull()
            ?: groups.district.map { fixDigit(it) }.joinToString("")
        val series = groups.series.map { fixLetter(it) }.joinToString("")
        val number = groups.number.map { fixDigit(it) }.joinToString("")
        val plate = state + district + series + number
        return plate.takeIf { isValidPlate(it) }
    }

    private data class PlateGroups(
        val state: String,
        val district: String,
        val series: String,
        val number: String
    )

    private fun splitPlateGroups(compact: String): PlateGroups? {
        if (compact.length !in 9..12) return null
        if (!compact.take(2).all { it.isLetter() }) return null

        val number = compact.takeLast(4)
        if (number.length != 4) return null

        val middle = compact.drop(2).dropLast(4)
        if (middle.length !in 3..5) return null

        val district = middle.take(2)
        val series = middle.drop(2)
        if (series.isEmpty() || series.length > 3) return null

        return PlateGroups(
            state = compact.take(2),
            district = district,
            series = series,
            number = number
        )
    }

    private fun generateCorrectionVariants(raw: String): List<String> {
        val groups = splitPlateGroups(raw) ?: return emptyList()
        val variants = mutableListOf<String>()

        val districtOptions = districtCandidates(groups.district)
        val numberAlts = groups.number.map { digitAlternates(it) }

        for (district in districtOptions) {
            for (n0 in numberAlts[0]) {
                for (n1 in numberAlts[1]) {
                    for (n2 in numberAlts[2]) {
                        for (n3 in numberAlts[3]) {
                            variants.add(
                                groups.state + district + groups.series + "$n0$n1$n2$n3"
                            )
                        }
                    }
                }
            }
        }
        return variants.distinct()
    }

    private fun districtCandidates(raw: String): List<String> {
        val upper = raw.uppercase()
        val knownMisreads = mapOf(
            "US" to listOf("09", "05"),
            "OS" to listOf("09", "05"),
            "O9" to listOf("09"),
            "OT" to listOf("01"),
            "O1" to listOf("01"),
            "OI" to listOf("01"),
            "0T" to listOf("01"),
            "0I" to listOf("01"),
            "O0" to listOf("01", "00"),
            "1O" to listOf("10", "01"),
        )
        knownMisreads[upper]?.let { return it }

        val alts = raw.map { digitAlternates(it) }
        val results = mutableListOf<String>()
        for (d0 in alts[0]) {
            for (d1 in alts[1]) {
                results.add("$d0$d1")
            }
        }
        return results.distinct()
    }

    private fun fixLetter(c: Char): Char = when (c) {
        '0', 'O', 'Q', 'D' -> 'O'
        '1', 'I', 'L', 'T', '|' -> 'I'
        '5', 'S' -> 'S'
        '8', 'B' -> 'B'
        '6', 'G' -> 'G'
        '2', 'Z' -> 'Z'
        '4', 'A' -> 'A'
        in 'A'..'Z' -> c
        in '0'..'9' -> when (c) {
            '0' -> 'O'
            '1' -> 'I'
            '5' -> 'S'
            '8' -> 'B'
            else -> c
        }
        else -> c
    }

    private fun fixDigit(c: Char): Char = when (c) {
        'O', 'Q', 'D', 'U', 'C' -> '0'
        'I', 'L', 'T', '|' -> '1'
        'Z' -> '2'
        'S' -> '5'
        'G' -> '6'
        'B' -> '8'
        'g', 'q' -> '9'
        in '0'..'9' -> c
        else -> c
    }

    private fun digitAlternates(c: Char): List<Char> = when (c) {
        'O', 'Q', 'D', 'U', 'C', '0' -> listOf('0')
        'I', 'L', 'T', '|', '1' -> listOf('1')
        'Z', '2' -> listOf('2')
        'S', '5' -> listOf('5', '9')
        'G', '6' -> listOf('6')
        'B', '8' -> listOf('8')
        'g', 'q', '9' -> listOf('9')
        in '0'..'9' -> listOf(c)
        else -> listOf(fixDigit(c))
    }

    private fun isValidPlate(plate: String): Boolean {
        if (!STRICT_PLATE.matches(plate)) return false
        if (!INDIAN_STATE_CODES.contains(plate.take(2))) return false
        return true
    }

    private fun scorePlate(plate: String): Int {
        var score = 0
        if (!isValidPlate(plate)) return score
        score += 100
        if (plate.length == 10 || plate.length == 11) score += 10
        if (INDIAN_STATE_CODES.contains(plate.take(2))) score += 20
        val district = plate.substring(2, 4).toIntOrNull() ?: 0
        if (district in 1..99) score += 5
        return score
    }

    private fun compact(raw: String): String =
        raw.uppercase().replace(Regex("[^A-Z0-9]"), "")

    private fun isInScanRegion(box: Rect?, imageWidth: Int, imageHeight: Int): Boolean {
        if (box == null || imageWidth <= 0 || imageHeight <= 0) return true
        val relX = abs(box.exactCenterX() - imageWidth / 2f) / imageWidth
        val relY = abs(box.exactCenterY() - imageHeight / 2f) / imageHeight
        return relX <= 0.38f && relY <= 0.28f
    }
}
