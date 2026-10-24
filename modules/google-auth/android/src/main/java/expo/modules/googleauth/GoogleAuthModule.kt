package expo.modules.googleauth

import android.app.Activity
import com.google.android.gms.auth.api.identity.AuthorizationRequest
import com.google.android.gms.auth.api.identity.Identity
import com.google.android.gms.common.api.ApiException
import com.google.android.gms.common.api.Scope
import expo.modules.kotlin.Promise
import expo.modules.kotlin.exception.CodedException
import expo.modules.kotlin.exception.Exceptions
import expo.modules.kotlin.functions.Queues
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

private const val AUTH_REQUEST_CODE = 0x6D21

// drive.file: only files this app creates or the user opens with it. No access to the rest of Drive.
private val SCOPES = listOf(
  Scope("https://www.googleapis.com/auth/drive.file"),
  Scope("https://www.googleapis.com/auth/userinfo.email"),
)

class NeedsConsentException :
  CodedException("ERR_NEEDS_CONSENT", "Google Drive needs to be connected again", null)

class AuthorizationFailedException(cause: Throwable) :
  CodedException("ERR_AUTHORIZATION", "Google sign-in failed: ${cause.message}", cause)

class AuthInProgressException :
  CodedException("ERR_AUTH_IN_PROGRESS", "Google sign-in is already open", null)

/** Bridge to Google's Authorization API (the successor of the deprecated Google Sign-In SDK). */
class GoogleAuthModule : Module() {
  private var pending: Promise? = null

  override fun definition() = ModuleDefinition {
    Name("GoogleAuth")

    AsyncFunction("authorizeAsync") { interactive: Boolean, promise: Promise ->
      val activity = appContext.currentActivity ?: throw Exceptions.MissingActivity()
      if (pending != null) throw AuthInProgressException()

      val request = AuthorizationRequest.builder().setRequestedScopes(SCOPES).build()
      Identity.getAuthorizationClient(activity)
        .authorize(request)
        .addOnSuccessListener { result ->
          if (!result.hasResolution()) {
            promise.resolve(result.accessToken)
            return@addOnSuccessListener
          }
          if (!interactive) {
            promise.reject(NeedsConsentException())
            return@addOnSuccessListener
          }
          // Show the account picker / consent screen; the answer arrives in OnActivityResult.
          try {
            pending = promise
            activity.startIntentSenderForResult(result.pendingIntent!!.intentSender, AUTH_REQUEST_CODE, null, 0, 0, 0)
          } catch (e: Exception) {
            pending = null
            promise.reject(AuthorizationFailedException(e))
          }
        }
        .addOnFailureListener { e -> promise.reject(AuthorizationFailedException(e)) }
    }.runOnQueue(Queues.MAIN)

    OnActivityResult { activity, payload ->
      if (payload.requestCode != AUTH_REQUEST_CODE) return@OnActivityResult
      val promise = pending ?: return@OnActivityResult
      pending = null

      if (payload.resultCode != Activity.RESULT_OK) {
        promise.resolve(null)
        return@OnActivityResult
      }
      try {
        val result = Identity.getAuthorizationClient(activity).getAuthorizationResultFromIntent(payload.data)
        promise.resolve(result.accessToken)
      } catch (e: ApiException) {
        promise.reject(AuthorizationFailedException(e))
      }
    }
  }
}
