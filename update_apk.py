#!/usr/bin/env python3
import os
import shutil
import zipfile
import subprocess
import struct
import hashlib
import zlib

def patch_dex(dex_bytes, old_id, new_id):
    if old_id not in dex_bytes:
        print(f"Old client ID not in this dex")
        return dex_bytes
    assert len(old_id) == len(new_id), "ID lengths must match"
    patched = bytearray(dex_bytes.replace(old_id, new_id))
    # SHA-1 signature (bytes 12-32: SHA1 of bytes 32 to EOF)
    sha1 = hashlib.sha1(patched[32:]).digest()
    patched[12:32] = sha1
    # Adler-32 checksum (bytes 8-12: Adler32 of bytes 12 to EOF)
    adler = zlib.adler32(patched[12:]) & 0xffffffff
    patched[8:12] = struct.pack("<I", adler)
    print("DEX successfully patched with new Web Client ID!")
    return bytes(patched)

def main():
    root = "/home/preet/Jobtic New UI⁄UX"
    base_apk = os.path.join(root, "Jobtic-v2.1.apk")
    if not os.path.exists(base_apk):
        base_apk = os.path.join(root, "Jobtic-v2.0.apk")
    
    unsigned_apk = os.path.join(root, "Jobtic-temp-unsigned.apk")
    v22_apk = os.path.join(root, "Jobtic-v2.2.apk")
    final_apk = os.path.join(root, "Jobtic-Interviewer-debug.apk")
    copy_apk = os.path.join(root, "Jobtic.apk")
    public_apk = os.path.join(root, "public/Jobtic.apk")
    dist_dir = os.path.join(root, "dist")
    keystore_path = os.path.join(root, "debug.keystore")
    java = os.path.join(root, "jdk-21/bin/java")
    signer_jar = os.path.join(root, "tools/uber-apk-signer.jar")
    aapt = os.path.join(root, "android-sdk/build-tools/34.0.0/aapt")

    old_client_id = b"237511348320-4gl13th13g91d95nanfgj40anunm8t9f.apps.googleusercontent.com"
    new_client_id = b"237511348320-3lrdbt46tns1ev74rnpv15adjut3uqq9.apps.googleusercontent.com"

    if not os.path.exists(base_apk):
        raise RuntimeError(f"Base APK not found at {base_apk}")

    print(f"Repackaging APK with updated Web Client ID and v2.2 version bump...")
    if os.path.exists(unsigned_apk):
        os.remove(unsigned_apk)

    with zipfile.ZipFile(base_apk, 'r') as zin:
        with zipfile.ZipFile(unsigned_apk, 'w') as zout:
            for item in zin.infolist():
                filename = item.filename
                # Skip old assets/public files
                if filename.startswith("assets/public/"):
                    continue
                # Skip old signature files
                if filename.startswith("META-INF/") and (
                    filename.endswith(".SF") or
                    filename.endswith(".RSA") or
                    filename.endswith(".DSA") or
                    filename.endswith(".EC") or
                    filename.endswith("MANIFEST.MF")
                ):
                    continue

                data = zin.read(filename)
                compress_type = item.compress_type

                if filename == "classes4.dex":
                    data = patch_dex(data, old_client_id, new_client_id)

                if filename == "AndroidManifest.xml":
                    mb = bytearray(data)
                    # Bump versionName to 2.2
                    for old_v in ('2.1', '2.0', '1.9', '1.8', '1.7'):
                        encoded_v = old_v.encode('utf-16le')
                        if mb[1396:1396+len(encoded_v)] == encoded_v:
                            mb[1396:1396+len(encoded_v)] = '2.2'.encode('utf-16le')
                            break
                    # Bump versionCode to 13
                    curr_vc = struct.unpack('<I', mb[6136:6140])[0]
                    if curr_vc in (7, 8, 9, 10, 11, 12):
                        mb[6136:6140] = struct.pack('<I', 13)
                    data = bytes(mb)

                if compress_type == zipfile.ZIP_DEFLATED:
                    zout.writestr(filename, data, compress_type=compress_type, compresslevel=2)
                else:
                    zout.writestr(filename, data, compress_type=compress_type)

            # Add all updated files from dist_dir
            if os.path.exists(dist_dir):
                for dirpath, _, filenames in os.walk(dist_dir):
                    for fname in filenames:
                        abs_path = os.path.join(dirpath, fname)
                        rel_path = os.path.relpath(abs_path, dist_dir)
                        zip_entry = "assets/public/" + rel_path.replace("\\", "/")
                        with open(abs_path, 'rb') as f:
                            file_data = f.read()
                        zout.writestr(zip_entry, file_data, compress_type=zipfile.ZIP_DEFLATED, compresslevel=2)

    print("Signing APK with v1, v2, and v3 schemes and zipaligning...")
    cmd_sign = [
        java, "-jar", signer_jar,
        "-a", unsigned_apk,
        "--ks", keystore_path,
        "--ksPass", "android",
        "--ksKeyPass", "android",
        "--ksAlias", "androiddebugkey",
        "--overwrite"
    ]
    subprocess.check_call(cmd_sign)

    # Move signed & zipaligned APK to destinations
    shutil.copyfile(unsigned_apk, v22_apk)
    shutil.copyfile(unsigned_apk, final_apk)
    shutil.copyfile(unsigned_apk, copy_apk)
    shutil.copyfile(unsigned_apk, public_apk)
    os.remove(unsigned_apk)

    size = os.path.getsize(v22_apk)
    size_mb = size / (1024 * 1024)
    print(f"\nSUCCESS!")
    print(f"Updated and signed APK: {v22_apk}")
    print(f"Mirrored to:            {copy_apk}")
    print(f"Mirrored to:            {public_apk}")
    print(f"Final Size:             {size} bytes ({size_mb:.2f} MB)")

    # Verify with aapt
    if os.path.exists(aapt):
        badging = subprocess.check_output([aapt, "dump", "badging", v22_apk]).decode("utf-8")
        print("\nAPK Package Badging:")
        for line in badging.splitlines()[:4]:
            print(" ", line)

if __name__ == "__main__":
    main()
