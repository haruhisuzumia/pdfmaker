package expo.modules.documentscanner

import android.app.Activity
import com.google.mlkit.vision.documentscanner.GmsDocumentScannerOptions
import com.google.mlkit.vision.documentscanner.GmsDocumentScanning
import com.google.mlkit.vision.documentscanner.GmsDocumentScanningResult
import expo.modules.kotlin.Promise
import expo.modules.kotlin.exception.CodedException
import expo.modules.kotlin.exception.Exceptions
import expo.modules.kotlin.functions.Queues
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import expo.modules.kotlin.records.Field
import expo.modules.kotlin.records.Record

private const val SCAN_REQUEST_CODE = 0x5CA9

class ScanOptions : Record {
  @Field var pageLimit: Int = 50
  @Field var galleryImportAllowed: Boolean = true
}

class ScannerUnavailableException(cause: Throwable) :
  CodedException("ERR_SCANNER_UNAVAILABLE", "The document scanner is not available: ${cause.message}", cause)

class ScanInProgressException :
  CodedException("ERR_SCAN_IN_PROGRESS", "A scan is already in progress", null)

/** Thin bridge to Google's ML Kit document scanner (edge detection, flattening, filters, cleanup). */
class DocumentScannerModule : Module() {
  private var pending: Promise? = null

  override fun definition() = ModuleDefinition {
    Name("DocumentScanner")

    AsyncFunction("scanAsync") { options: ScanOptions, promise: Promise ->
      val activity = appContext.currentActivity ?: throw Exceptions.MissingActivity()
      if (pending != null) throw ScanInProgressException()

      val scannerOptions = GmsDocumentScannerOptions.Builder()
        .setScannerMode(GmsDocumentScannerOptions.SCANNER_MODE_FULL)
        .setResultFormats(GmsDocumentScannerOptions.RESULT_FORMAT_JPEG)
        .setPageLimit(options.pageLimit.coerceAtLeast(1))
        .setGalleryImportAllowed(options.galleryImportAllowed)
        .build()

      pending = promise
      GmsDocumentScanning.getClient(scannerOptions)
        .getStartScanIntent(activity)
        .addOnSuccessListener { intentSender ->
          try {
            activity.startIntentSenderForResult(intentSender, SCAN_REQUEST_CODE, null, 0, 0, 0)
          } catch (e: Exception) {
            pending = null
            promise.reject(ScannerUnavailableException(e))
          }
        }
        .addOnFailureListener { e ->
          // Usually Google Play services is missing or still downloading the scanner module.
          pending = null
          promise.reject(ScannerUnavailableException(e))
        }
    }.runOnQueue(Queues.MAIN)

    OnActivityResult { _, payload ->
      if (payload.requestCode != SCAN_REQUEST_CODE) return@OnActivityResult
      val promise = pending ?: return@OnActivityResult
      pending = null

      if (payload.resultCode != Activity.RESULT_OK) {
        promise.resolve(null)
        return@OnActivityResult
      }
      val pages = GmsDocumentScanningResult.fromActivityResultIntent(payload.data)?.pages.orEmpty()
      promise.resolve(pages.map { it.imageUri.toString() })
    }
  }
}
