package expo.modules.mediastore

import android.content.ContentValues
import android.content.Context
import android.net.Uri
import android.provider.MediaStore
import android.provider.OpenableColumns
import expo.modules.kotlin.exception.CodedException
import expo.modules.kotlin.exception.Exceptions
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import expo.modules.kotlin.records.Field
import expo.modules.kotlin.records.Record
import java.io.File

/** Files we write land in the shared Documents/<folder> directory and survive an uninstall. */
private const val DEFAULT_FOLDER = "PDF Maker"

class SavedFile : Record {
  @Field var uri: String = ""
  @Field var name: String = ""
  @Field var size: Long = 0
}

class SaveFailedException(reason: String) :
  CodedException("ERR_MEDIA_STORE_SAVE", "Could not save the file: $reason", null)

class ReadFailedException(uri: String) :
  CodedException("ERR_MEDIA_STORE_READ", "Could not read $uri", null)

class NotOwnedException(uri: String) :
  CodedException("ERR_MEDIA_STORE_NOT_OWNED", "The app can no longer change $uri", null)

class MediaStoreModule : Module() {
  private val context: Context
    get() = appContext.reactContext ?: throw Exceptions.ReactContextLost()

  override fun definition() = ModuleDefinition {
    Name("MediaStore")

    // Copies a file:// or content:// source into Documents/<folder> and returns the new entry.
    AsyncFunction("saveToDocumentsAsync") { sourceUri: String, displayName: String, mimeType: String, folder: String? ->
      saveToDocuments(Uri.parse(sourceUri), displayName, mimeType, folder ?: DEFAULT_FOLDER)
    }

    // Replaces the content of an entry we created, keeping its name and place in the folder.
    AsyncFunction("overwriteAsync") { targetUri: String, sourceUri: String ->
      overwrite(Uri.parse(targetUri), Uri.parse(sourceUri))
    }

    // Saves a JPEG into Pictures/<folder> so it shows up in the Gallery and photo pickers.
    AsyncFunction("saveImageToGalleryAsync") { sourceUri: String, displayName: String, folder: String? ->
      insertAndCopy(
        MediaStore.Images.Media.getContentUri(MediaStore.VOLUME_EXTERNAL_PRIMARY),
        Uri.parse(sourceUri),
        displayName,
        "image/jpeg",
        "Pictures/${folder ?: DEFAULT_FOLDER}",
      )
    }

    // Returns false when the entry is already gone or no longer ours (e.g. after a reinstall).
    AsyncFunction("deleteAsync") { uri: String ->
      try {
        context.contentResolver.delete(Uri.parse(uri), null, null) > 0
      } catch (e: SecurityException) {
        false
      }
    }

    AsyncFunction("existsAsync") { uri: String ->
      try {
        context.contentResolver.query(Uri.parse(uri), arrayOf(OpenableColumns.SIZE), null, null, null)
          ?.use { it.moveToFirst() } ?: false
      } catch (e: SecurityException) {
        false
      }
    }

    // expo-sharing and pdf-lib need a real file path, so copy the entry into the app cache.
    AsyncFunction("copyToCacheAsync") { uri: String, fileName: String ->
      val target = File(context.cacheDir, "shared/$fileName")
      target.parentFile?.mkdirs()
      val input = context.contentResolver.openInputStream(Uri.parse(uri)) ?: throw ReadFailedException(uri)
      input.use { source -> target.outputStream().use { source.copyTo(it) } }
      Uri.fromFile(target).toString()
    }
  }

  private fun saveToDocuments(source: Uri, displayName: String, mimeType: String, folder: String): SavedFile =
    insertAndCopy(
      MediaStore.Files.getContentUri(MediaStore.VOLUME_EXTERNAL_PRIMARY),
      source,
      displayName,
      mimeType,
      "Documents/$folder",
    )

  private fun overwrite(target: Uri, source: Uri): SavedFile {
    val resolver = context.contentResolver
    try {
      val input = resolver.openInputStream(source) ?: throw ReadFailedException(source.toString())
      val output = resolver.openOutputStream(target, "wt") ?: throw SaveFailedException("cannot open output stream")
      input.use { i -> output.use { o -> i.copyTo(o) } }
    } catch (e: SecurityException) {
      throw NotOwnedException(target.toString())
    }
    return describe(target, "")
  }

  private fun describe(uri: Uri, fallbackName: String): SavedFile = SavedFile().apply {
    this.uri = uri.toString()
    name = fallbackName
    context.contentResolver
      .query(uri, arrayOf(MediaStore.MediaColumns.DISPLAY_NAME, MediaStore.MediaColumns.SIZE), null, null, null)
      ?.use { cursor ->
        if (cursor.moveToFirst()) {
          name = cursor.getString(0) ?: fallbackName
          size = cursor.getLong(1)
        }
      }
  }

  private fun insertAndCopy(collection: Uri, source: Uri, displayName: String, mimeType: String, relativePath: String): SavedFile {
    val resolver = context.contentResolver
    val values = ContentValues().apply {
      put(MediaStore.MediaColumns.DISPLAY_NAME, displayName)
      put(MediaStore.MediaColumns.MIME_TYPE, mimeType)
      put(MediaStore.MediaColumns.RELATIVE_PATH, relativePath)
      put(MediaStore.MediaColumns.IS_PENDING, 1)
    }
    val target = resolver.insert(collection, values) ?: throw SaveFailedException("MediaStore insert returned null")

    try {
      val input = resolver.openInputStream(source) ?: throw ReadFailedException(source.toString())
      val output = resolver.openOutputStream(target) ?: throw SaveFailedException("cannot open output stream")
      input.use { i -> output.use { o -> i.copyTo(o) } }

      resolver.update(target, ContentValues().apply { put(MediaStore.MediaColumns.IS_PENDING, 0) }, null, null)
    } catch (e: Exception) {
      resolver.delete(target, null, null)
      if (e is CodedException) throw e
      throw SaveFailedException(e.message ?: e.javaClass.simpleName)
    }

    // MediaStore may rename on collision ("scan (1).pdf"), so read back the final name and size.
    return describe(target, displayName)
  }
}
