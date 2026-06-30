package com.evinventory.spareparts

import android.Manifest
import android.content.Intent
import android.content.pm.PackageManager
import android.os.Bundle
import android.widget.Toast
import androidx.activity.result.contract.ActivityResultContracts
import androidx.appcompat.app.AppCompatActivity
import androidx.camera.core.CameraSelector
import androidx.camera.core.ImageAnalysis
import androidx.camera.core.Preview
import androidx.camera.lifecycle.ProcessCameraProvider
import androidx.core.content.ContextCompat
import com.evinventory.spareparts.databinding.ActivityPlateScanBinding
import com.google.mlkit.vision.common.InputImage
import com.google.mlkit.vision.text.TextRecognition
import com.google.mlkit.vision.text.latin.TextRecognizerOptions
import java.util.concurrent.Executors

class PlateScanActivity : AppCompatActivity() {

    companion object {
        const val EXTRA_VEHICLE = "vehicle"
    }

    private lateinit var binding: ActivityPlateScanBinding
    private val cameraExecutor = Executors.newSingleThreadExecutor()
    private val textRecognizer = TextRecognition.getClient(TextRecognizerOptions.DEFAULT_OPTIONS)
    private var detectedPlate: String? = null
    private var isProcessing = false

    private val requestCameraPermission = registerForActivityResult(
        ActivityResultContracts.RequestPermission()
    ) { granted ->
        if (granted) startCamera()
        else {
            Toast.makeText(this, R.string.camera_permission_denied, Toast.LENGTH_LONG).show()
            finish()
        }
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        binding = ActivityPlateScanBinding.inflate(layoutInflater)
        setContentView(binding.root)

        supportActionBar?.hide()

        binding.buttonUsePlate.setOnClickListener {
            detectedPlate?.let { plate ->
                setResult(RESULT_OK, Intent().putExtra(EXTRA_VEHICLE, plate))
                finish()
            }
        }

        binding.buttonCancelScan.setOnClickListener { finish() }

        if (ContextCompat.checkSelfPermission(this, Manifest.permission.CAMERA)
            == PackageManager.PERMISSION_GRANTED
        ) {
            startCamera()
        } else {
            requestCameraPermission.launch(Manifest.permission.CAMERA)
        }
    }

    private fun startCamera() {
        val cameraProviderFuture = ProcessCameraProvider.getInstance(this)
        cameraProviderFuture.addListener({
            val cameraProvider = cameraProviderFuture.get()

            val preview = Preview.Builder().build()
            preview.setSurfaceProvider(binding.previewView.surfaceProvider)

            val imageAnalysis = ImageAnalysis.Builder()
                .setBackpressureStrategy(ImageAnalysis.STRATEGY_KEEP_ONLY_LATEST)
                .build()

            imageAnalysis.setAnalyzer(cameraExecutor) { imageProxy ->
                if (isProcessing) {
                    imageProxy.close()
                    return@setAnalyzer
                }

                val mediaImage = imageProxy.image
                if (mediaImage == null) {
                    imageProxy.close()
                    return@setAnalyzer
                }

                isProcessing = true
                val inputImage = InputImage.fromMediaImage(
                    mediaImage,
                    imageProxy.imageInfo.rotationDegrees
                )

                textRecognizer.process(inputImage)
                    .addOnSuccessListener { visionText ->
                        PlateTextExtractor.extractFromVisionText(visionText)?.let { plate ->
                            if (plate != detectedPlate) {
                                detectedPlate = plate
                                runOnUiThread { showDetectedPlate(plate) }
                            }
                        }
                    }
                    .addOnCompleteListener {
                        isProcessing = false
                        imageProxy.close()
                    }
            }

            try {
                cameraProvider.unbindAll()
                cameraProvider.bindToLifecycle(
                    this,
                    CameraSelector.DEFAULT_BACK_CAMERA,
                    preview,
                    imageAnalysis
                )
            } catch (_: Exception) {
                Toast.makeText(this, R.string.camera_start_failed, Toast.LENGTH_LONG).show()
                finish()
            }
        }, ContextCompat.getMainExecutor(this))
    }

    private fun showDetectedPlate(plate: String) {
        binding.textDetectedPlate.text = plate
        binding.buttonUsePlate.isEnabled = true
    }

    override fun onDestroy() {
        super.onDestroy()
        cameraExecutor.shutdown()
        textRecognizer.close()
    }
}
