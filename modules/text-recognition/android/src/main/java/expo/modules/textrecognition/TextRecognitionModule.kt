package expo.modules.textrecognition

import android.net.Uri
import com.google.mlkit.vision.common.InputImage
import com.google.mlkit.vision.text.TextRecognition
import com.google.mlkit.vision.text.TextRecognizer
import com.google.mlkit.vision.text.devanagari.DevanagariTextRecognizerOptions
import com.google.mlkit.vision.text.latin.TextRecognizerOptions
import expo.modules.kotlin.Promise
import expo.modules.kotlin.exception.CodedException
import expo.modules.kotlin.exception.Exceptions
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

class RecognitionFailedException(cause: Throwable) :
  CodedException("ERR_TEXT_RECOGNITION", "Could not read text: ${cause.message}", cause)

/** On-device OCR with Google ML Kit (models delivered by Google Play services). */
class TextRecognitionModule : Module() {
  private val recognizers = mutableMapOf<String, TextRecognizer>()

  private fun recognizer(script: String): TextRecognizer = recognizers.getOrPut(script) {
    when (script) {
      "devanagari" -> TextRecognition.getClient(DevanagariTextRecognizerOptions.Builder().build())
      else -> TextRecognition.getClient(TextRecognizerOptions.DEFAULT_OPTIONS)
    }
  }

  override fun definition() = ModuleDefinition {
    Name("TextRecognition")

    AsyncFunction("recognizeAsync") { imageUri: String, script: String, promise: Promise ->
      val context = appContext.reactContext ?: throw Exceptions.ReactContextLost()
      val image = try {
        InputImage.fromFilePath(context, Uri.parse(imageUri))
      } catch (e: Exception) {
        throw RecognitionFailedException(e)
      }
      recognizer(script).process(image)
        .addOnSuccessListener { result ->
          promise.resolve(result.textBlocks.joinToString("\n\n") { it.text })
        }
        .addOnFailureListener { e -> promise.reject(RecognitionFailedException(e)) }
    }

    OnDestroy {
      recognizers.values.forEach { it.close() }
      recognizers.clear()
    }
  }
}
