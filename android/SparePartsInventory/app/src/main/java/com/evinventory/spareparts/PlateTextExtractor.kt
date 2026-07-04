package com.evinventory.spareparts

import android.graphics.Rect
import com.google.mlkit.vision.text.Text
import kotlin.math.abs
import kotlin.math.max

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
        val rawCandidates = linkedSetOf<String>()

        tryCombineLines(visionText, imageWidth, imageHeight)?.let { rawCandidates.add(it) }

        for (block in visionText.textBlocks) {
            if (!isInScanRegion(block.boundingBox, imageWidth, imageHeight)) continue
            collectTexts(block.text)?.let { rawCandidates.add(it) }
            for (line in block.lines) {
                if (!isInScanRegion(line.boundingBox, imageWidth, imageHeight)) continue
                collectTexts(line.text)?.let { rawCandidates.add(it) }
                for (element in line.elements) {
                    if (!isInScanRegion(element.boundingBox, imageWidth, imageHeight)) continue
                    collectTexts(element.text)?.let { rawCandidates.add(it) }
                }
            }
        }

        if (rawCandidates.isEmpty()) {
            collectTexts(visionText.text)?.let { rawCandidates.add(it) }
        }

        return rawCandidates
            .mapNotNull { raw -> extractPlate(raw)?.let { plate -> plate to raw } }
            .maxByOrNull { (plate, raw) -> scorePlate(plate, compact(raw)) }
            ?.first
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
            listOf(
                top + bottom,
                top + bottom.takeLast(minOf(6, bottom.length)),
                top.dropLast(1) + bottom
            ).forEach { combined ->
                extractPlate(combined)?.let { return combined }
            }
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
            correctToPlate(match.value, compact)?.let { return it }
        }
        return null
    }

    private fun correctToPlate(compact: String, rawSource: String = compact): String? {
        val scores = linkedMapOf<String, Int>()

        for (len in listOf(11, 10, 12, 9)) {
            if (compact.length < len) continue
            val slice = compact.take(len)
            val rawSlice = rawSource.take(len)
            collectValidPlates(slice, rawSlice, scores)
        }

        return scores.maxByOrNull { it.value }?.key
    }

    private fun collectValidPlates(slice: String, rawSlice: String, scores: MutableMap<String, Int>) {
        for (variant in allCorrectionVariants(slice)) {
            buildPlate(variant)?.let { plate ->
                val score = scorePlate(plate, rawSlice)
                scores[plate] = max(scores[plate] ?: 0, score)
            }
        }
    }

    private fun allCorrectionVariants(slice: String): List<PlateGroups> {
        val groups = splitPlateGroups(slice) ?: return emptyList()
        val results = mutableListOf<PlateGroups>()

        val districtOptions = districtCandidates(groups.district)
        val seriesOptions = seriesCandidates(groups.series)
        val numberOptions = numberCandidates(groups.number)

        for (district in districtOptions) {
            for (series in seriesOptions) {
                for (number in numberOptions) {
                    results.add(
                        PlateGroups(
                            state = groups.state.map { fixLetter(it) }.joinToString(""),
                            district = district,
                            series = series,
                            number = number
                        )
                    )
                }
            }
        }
        return results.distinct()
    }

    private fun buildPlate(groups: PlateGroups): String? {
        val plate = groups.state + groups.district + groups.series + groups.number
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

    private fun seriesCandidates(series: String): List<String> {
        val perChar = series.map { letterAlternates(it) }
        return cartesianJoin(perChar).distinct()
    }

    private fun numberCandidates(number: String): List<String> {
        val perChar = number.map { digitAlternates(it) }
        return cartesianJoin(perChar).distinct()
    }

    private fun cartesianJoin(options: List<List<Char>>): List<String> {
        if (options.isEmpty()) return listOf("")
        var results = listOf("")
        for (opts in options) {
            results = results.flatMap { prefix ->
                opts.map { ch -> prefix + ch }
            }
        }
        return results
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

        return cartesianJoin(raw.map { digitAlternates(it) }).distinct()
    }

    private fun fixLetter(c: Char): Char = when (c) {
        '0', 'O', 'Q', 'D' -> 'O'
        '1', 'L', '|' -> 'I'
        'I' -> 'I'
        'T' -> 'T'
        '5', 'S' -> 'S'
        '8', 'B' -> 'B'
        '6', 'G' -> 'G'
        '2', 'Z' -> 'Z'
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

    private fun letterAlternates(c: Char): List<Char> = when (c) {
        'I', '1', 'L', '|' -> listOf('I', 'T')
        'T' -> listOf('T', 'I')
        'O', '0', 'Q', 'D' -> listOf('O')
        'S', '5' -> listOf('S')
        'B', '8' -> listOf('B')
        'G', '6' -> listOf('G')
        'Z', '2' -> listOf('Z')
        in 'A'..'Z' -> listOf(c)
        else -> listOf(fixLetter(c))
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

    private fun scorePlate(plate: String, rawSlice: String = ""): Int {
        var score = 0
        if (!isValidPlate(plate)) return score
        score += 100
        if (plate.length == 10 || plate.length == 11) score += 10
        if (INDIAN_STATE_CODES.contains(plate.take(2))) score += 20
        val district = plate.substring(2, 4).toIntOrNull() ?: 0
        if (district in 1..99) score += 5

        if (rawSlice.length == plate.length) {
            val plateSeries = plate.substring(4, plate.length - 4)
            val rawSeries = rawSlice.substring(4, plate.length - 4)
            for (i in plateSeries.indices) {
                if (i >= rawSeries.length) continue
                when {
                    plateSeries[i] == rawSeries[i] -> score += 3
                    rawSeries[i] == 'I' && plateSeries[i] == 'T' -> score += 8
                    rawSeries[i] == 'T' && plateSeries[i] == 'I' -> score += 2
                    rawSeries[i] == 'O' && plateSeries[i] == '0' -> score += 6
                    rawSeries[i] == 'U' && plateSeries[i] == '0' -> score += 6
                    rawSeries[i] == 'S' && plateSeries[i] == '9' -> score += 6
                }
            }
            for (i in plate.indices) {
                if (i < rawSlice.length && plate[i] == rawSlice[i]) score += 1
            }
        }
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
