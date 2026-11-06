package com.jobtic.interviewer;

import android.content.MutableContextWrapper;
import android.os.CancellationSignal;
import android.util.Base64;

import androidx.core.content.ContextCompat;
import androidx.credentials.ClearCredentialStateRequest;
import androidx.credentials.Credential;
import androidx.credentials.CredentialManager;
import androidx.credentials.CredentialManagerCallback;
import androidx.credentials.CustomCredential;
import androidx.credentials.GetCredentialRequest;
import androidx.credentials.GetCredentialResponse;
import androidx.credentials.exceptions.ClearCredentialException;
import androidx.credentials.exceptions.GetCredentialCancellationException;
import androidx.credentials.exceptions.GetCredentialException;
import androidx.credentials.exceptions.NoCredentialException;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.google.android.libraries.identity.googleid.GetSignInWithGoogleOption;
import com.google.android.libraries.identity.googleid.GoogleIdTokenCredential;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.SecureRandom;
import java.util.Locale;

/** Native account chooser only. Tokens are verified by Supabase, never trusted locally. */
@CapacitorPlugin(name = "NativeGoogleAuth")
public class NativeGoogleAuthPlugin extends Plugin {
    // Public Web OAuth client ID. The client secret belongs only in Supabase.
    private static final String WEB_CLIENT_ID =
        "237511348320-4gl13th13g91d95nanfgj40anunm8t9f.apps.googleusercontent.com";
    private CancellationSignal cancellationSignal;
    private PluginCall pendingCall;

    @PluginMethod
    public void signIn(PluginCall call) {
        getActivity().runOnUiThread(() -> {
            if (pendingCall != null) {
                call.reject("Google sign-in is already open.", "SIGN_IN_IN_PROGRESS");
                return;
            }
            try {
                byte[] randomBytes = new byte[32];
                new SecureRandom().nextBytes(randomBytes);
                String rawNonce = Base64.encodeToString(randomBytes,
                    Base64.URL_SAFE | Base64.NO_WRAP | Base64.NO_PADDING);
                byte[] hash = MessageDigest.getInstance("SHA-256")
                    .digest(rawNonce.getBytes(StandardCharsets.UTF_8));
                StringBuilder hashedNonce = new StringBuilder();
                for (byte value : hash) {
                    hashedNonce.append(String.format(Locale.ROOT, "%02x", value & 0xff));
                }

                GetSignInWithGoogleOption googleOption = new GetSignInWithGoogleOption.Builder(WEB_CLIENT_ID)
                    .setNonce(hashedNonce.toString())
                    .build();
                GetCredentialRequest request = new GetCredentialRequest.Builder()
                    .addCredentialOption(googleOption)
                    .build();
                pendingCall = call;
                cancellationSignal = new CancellationSignal();
                CredentialManager.create(getContext()).getCredentialAsync(
                    new MutableContextWrapper(getActivity()), request, cancellationSignal,
                    ContextCompat.getMainExecutor(getContext()),
                    new CredentialManagerCallback<GetCredentialResponse, GetCredentialException>() {
                        @Override
                        public void onResult(GetCredentialResponse response) {
                            pendingCall = null;
                            cancellationSignal = null;
                            try {
                                Credential credential = response.getCredential();
                                if (!(credential instanceof CustomCredential) ||
                                    !GoogleIdTokenCredential.TYPE_GOOGLE_ID_TOKEN_CREDENTIAL.equals(credential.getType())) {
                                    call.reject("Google returned an unsupported credential.", "INVALID_CREDENTIAL");
                                    return;
                                }
                                GoogleIdTokenCredential google = GoogleIdTokenCredential.createFrom(credential.getData());
                                JSObject result = new JSObject();
                                result.put("idToken", google.getIdToken());
                                result.put("nonce", rawNonce);
                                call.resolve(result);
                            } catch (Exception error) {
                                call.reject("Google returned an invalid sign-in response.", "INVALID_CREDENTIAL");
                            }
                        }

                        @Override
                        public void onError(GetCredentialException error) {
                            pendingCall = null;
                            cancellationSignal = null;
                            if (error instanceof GetCredentialCancellationException) {
                                call.reject("Google sign-in cancelled.", "SIGN_IN_CANCELLED");
                            } else if (error instanceof NoCredentialException) {
                                call.reject("No Google account is available. Add an account in Android Settings and try again.", "NO_GOOGLE_ACCOUNT");
                            } else {
                                call.reject("Google sign-in failed. Check your connection and Google Play Services. The app's Android OAuth client must match its package and signing SHA-1.", "GOOGLE_SIGN_IN_FAILED");
                            }
                        }
                    });
            } catch (Exception error) {
                pendingCall = null;
                cancellationSignal = null;
                call.reject("Could not open the native Google account chooser.", "GOOGLE_SIGN_IN_FAILED");
            }
        });
    }

    @PluginMethod
    public void signOut(PluginCall call) {
        CredentialManager.create(getContext()).clearCredentialStateAsync(
            new ClearCredentialStateRequest(), null, ContextCompat.getMainExecutor(getContext()),
            new CredentialManagerCallback<Void, ClearCredentialException>() {
                @Override
                public void onResult(Void result) { call.resolve(); }

                @Override
                public void onError(ClearCredentialException error) {
                    call.reject("Could not clear Google account selection.", "SIGN_OUT_FAILED");
                }
            });
    }

    @Override
    protected void handleOnDestroy() {
        if (cancellationSignal != null) cancellationSignal.cancel();
        cancellationSignal = null;
        pendingCall = null;
    }
}
