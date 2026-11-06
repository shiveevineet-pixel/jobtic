#!/usr/bin/env python3
import os
import shutil
import zipfile
import subprocess
import struct

def main():
    root = "/home/preet/Jobtic New UI⁄UX"
    base_apk = os.path.join(root, "Jobtic-v2.0.apk")
    if not os.path.exists(base_apk):
        base_apk = os.path.join(root, "Jobtic-v1.9.apk")
    
    unsigned_apk = os.path.join(root, "Jobtic-temp-unsigned.apk")
    v21_apk = os.path.join(root, "Jobtic-v2.1.apk")
    final_apk = os.path.join(root, "Jobtic-Interviewer-debug.apk")
    copy_apk = os.path.join(root, "Jobtic.apk")
    assets_dir = os.path.join(root, "android/app/src/main/assets/public")
    keystore_path = os.path.join(root, "debug.keystore")
    java = os.path.join(root, "jdk-21/bin/java")
    signer_jar = os.path.join(root, "tools/uber-apk-signer.jar")
    aapt = os.path.join(root, "android-sdk/build-tools/34.0.0/aapt")

    if not os.path.exists(base_apk):
        raise RuntimeError(f"Base APK not found at {base_apk}")

    print(f"Repackaging APK with updated assets from {assets_dir} and v2.1 version bump...")
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

                if filename == "AndroidManifest.xml":
                    mb = bytearray(data)
                    # Bump versionName to 2.1
                    for old_v in ('2.0', '1.9', '1.8', '1.7', '1.6'):
                        encoded_v = old_v.encode('utf-16le')
                        if mb[1396:1396+len(encoded_v)] == encoded_v:
                            mb[1396:1396+len(encoded_v)] = '2.1'.encode('utf-16le')
                            break
                    # Bump versionCode to 12
                    curr_vc = struct.unpack('<I', mb[6136:6140])[0]
                    if curr_vc in (7, 8, 9, 10, 11):
                        mb[6136:6140] = struct.pack('<I', 12)
                    data = bytes(mb)

                if compress_type == zipfile.ZIP_DEFLATED:
                    zout.writestr(filename, data, compress_type=compress_type, compresslevel=2)
                else:
                    zout.writestr(filename, data, compress_type=compress_type)

            # Add all updated files from assets_dir
            for dirpath, _, filenames in os.walk(assets_dir):
                for fname in filenames:
                    abs_path = os.path.join(dirpath, fname)
                    rel_path = os.path.relpath(abs_path, assets_dir)
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
    shutil.copyfile(unsigned_apk, v21_apk)
    shutil.copyfile(unsigned_apk, final_apk)
    shutil.copyfile(unsigned_apk, copy_apk)
    os.remove(unsigned_apk)

    size = os.path.getsize(v21_apk)
    size_mb = size / (1024 * 1024)
    print(f"\nSUCCESS!")
    print(f"Updated and signed APK: {v21_apk}")
    print(f"Mirrored to:            {copy_apk}")
    print(f"Mirrored to:            {final_apk}")
    print(f"Final Size:             {size} bytes ({size_mb:.2f} MB)")

    # Verify with aapt
    if os.path.exists(aapt):
        badging = subprocess.check_output([aapt, "dump", "badging", v21_apk]).decode("utf-8")
        print("\nAPK Package Badging:")
        for line in badging.splitlines()[:4]:
            print(" ", line)

if __name__ == "__main__":
    main()
