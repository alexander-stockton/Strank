// Strank offline uninstaller (console). Built into uninstall.exe by scripts/build-uninstall.js.
// Icon: Unranked badge (generated at build time from data/badges/unranked.svg colors).
//
// Option 1 removes the install folder, desktop shortcut, canonical %APPDATA%\Strank,
// and any Config `data directory` / `store path` overrides recorded in
// data-locations.json or config.txt so custom user-data locations are not left behind.

using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.IO;
using System.Text;
using System.Threading;

internal static class Program
{
    private const string AppName = "Strank";
    private const string UserDataFolderName = "Strank";
    private const string ShortcutName = "Strank.lnk";
    private const string ExeName = "Strank.exe";
    private const string DataLocationsFileName = "data-locations.json";
    private const string ConfigFileName = "config.txt";
    private const string SetupStateFileName = "setup-state.json";

    private static int Main(string[] args)
    {
        Console.Title = AppName + " Uninstaller";
        try
        {
            Console.OutputEncoding = Encoding.UTF8;
        }
        catch
        {
            /* ignore */
        }

        string installDir = Path.GetFullPath(AppDomain.CurrentDomain.BaseDirectory)
            .TrimEnd(Path.DirectorySeparatorChar, Path.AltDirectorySeparatorChar);
        string canonicalUserDataDir = Path.Combine(
            Environment.GetFolderPath(Environment.SpecialFolder.ApplicationData),
            UserDataFolderName
        );
        string desktopShortcut = Path.Combine(
            Environment.GetFolderPath(Environment.SpecialFolder.DesktopDirectory),
            ShortcutName
        );

        List<string> extraUserDataDirs = DiscoverExtraUserDataDirs(canonicalUserDataDir, installDir);

        Console.WriteLine();
        Console.WriteLine("=== " + AppName + " Uninstaller ===");
        Console.WriteLine();
        Console.WriteLine("Install folder:           " + installDir);
        Console.WriteLine("Canonical user data:      " + canonicalUserDataDir);
        if (extraUserDataDirs.Count > 0)
        {
            Console.WriteLine("Custom user data folder(s):");
            foreach (string d in extraUserDataDirs)
            {
                Console.WriteLine("  - " + d);
            }
        }
        else
        {
            Console.WriteLine("Custom user data folders: (none recorded)");
        }
        Console.WriteLine();
        Console.WriteLine("- Press 1 and hit Enter to remove all traces of Strank from your device.");
        Console.WriteLine("- Press 2 and hit Enter to remove the Strank data but keep your own user data.");
        Console.WriteLine("- Press 3 and hit Enter to cancel/quit.");
        Console.WriteLine();
        Console.Write("Choice: ");

        string line = Console.ReadLine();
        string choice = line == null ? "" : line.Trim();

        if (choice == "3")
        {
            Step("Cancel selected — no changes will be made.");
            Step("Exiting.");
            return 0;
        }

        if (choice != "1" && choice != "2")
        {
            Step("Unrecognized choice \"" + choice + "\" — treating as cancel.");
            Step("Exiting.");
            return 1;
        }

        bool removeUserData = choice == "1";
        Console.WriteLine();
        if (removeUserData)
        {
            Step("Option 1 selected: remove all traces (install files + all user data + shortcut).");
        }
        else
        {
            Step("Option 2 selected: remove install files + shortcut; keep user data.");
        }
        Console.WriteLine();

        try
        {
            StopRunningApp();
            RemoveDesktopShortcut(desktopShortcut);

            if (removeUserData)
            {
                foreach (string extra in extraUserDataDirs)
                {
                    RemoveUserData(extra);
                }
                RemoveUserData(canonicalUserDataDir);
            }
            else
            {
                Step("Keeping canonical user data folder: " + canonicalUserDataDir);
                if (Directory.Exists(canonicalUserDataDir))
                {
                    Step("Confirmed canonical user data still present (not deleted).");
                }
                else
                {
                    Step("Canonical user data folder was already absent.");
                }
                foreach (string extra in extraUserDataDirs)
                {
                    Step("Keeping custom user data folder: " + extra);
                }
            }

            RemoveInstallDirectory(installDir);
            Step("Uninstall sequence finished.");
            Step("This window will close shortly.");
            Thread.Sleep(1200);
            return 0;
        }
        catch (Exception ex)
        {
            Step("ERROR: " + ex.Message);
            Console.WriteLine();
            Console.WriteLine("Press Enter to close…");
            try
            {
                Console.ReadLine();
            }
            catch
            {
                /* ignore */
            }
            return 2;
        }
    }

    private static void Step(string message)
    {
        Console.WriteLine("→ " + message);
    }

    /// <summary>
    /// Collect custom data directories (Config overrides) that are not the canonical
    /// AppData folder and not inside the install tree.
    /// </summary>
    private static List<string> DiscoverExtraUserDataDirs(string canonicalUserDataDir, string installDir)
    {
        var found = new List<string>();
        var seen = new HashSet<string>(StringComparer.OrdinalIgnoreCase);

        Action<string> addDir = (raw) =>
        {
            if (string.IsNullOrWhiteSpace(raw)) return;
            string full;
            try
            {
                full = Path.GetFullPath(raw.Trim())
                    .TrimEnd(Path.DirectorySeparatorChar, Path.AltDirectorySeparatorChar);
            }
            catch
            {
                return;
            }
            if (string.IsNullOrEmpty(full)) return;
            if (PathsEqual(full, canonicalUserDataDir)) return;
            if (PathsEqual(full, installDir)) return;
            if (IsUnder(full, installDir)) return;
            // Refuse to delete drive roots / user profile root.
            if (IsUnsafeWipeTarget(full)) return;
            if (!seen.Add(full)) return;
            found.Add(full);
        };

        Action<string> addStorePath = (raw) =>
        {
            if (string.IsNullOrWhiteSpace(raw)) return;
            try
            {
                string full = Path.GetFullPath(raw.Trim());
                string parent = Path.GetDirectoryName(full);
                addDir(parent);
            }
            catch
            {
                /* ignore */
            }
        };

        // data-locations.json (written by the app whenever paths change)
        TryReadDataLocations(Path.Combine(canonicalUserDataDir, DataLocationsFileName), addDir, addStorePath);

        // setup-state.json may also record dataDirectory
        TryReadSetupState(Path.Combine(canonicalUserDataDir, SetupStateFileName), addDir);

        // config.txt overrides (authoritative when present)
        TryReadConfigPaths(Path.Combine(canonicalUserDataDir, ConfigFileName), addDir, addStorePath);

        return found;
    }

    private static void TryReadDataLocations(string filePath, Action<string> addDir, Action<string> addStorePath)
    {
        if (!File.Exists(filePath)) return;
        try
        {
            string json = File.ReadAllText(filePath);
            addDir(ExtractJsonString(json, "dataDirectory"));
            addDir(ExtractJsonString(json, "canonicalUserDataDir"));
            addStorePath(ExtractJsonString(json, "storePath"));
        }
        catch (Exception ex)
        {
            Step("Could not read " + DataLocationsFileName + ": " + ex.Message);
        }
    }

    private static void TryReadSetupState(string filePath, Action<string> addDir)
    {
        if (!File.Exists(filePath)) return;
        try
        {
            string json = File.ReadAllText(filePath);
            addDir(ExtractJsonString(json, "dataDirectory"));
            addDir(ExtractJsonString(json, "userDataDir"));
        }
        catch
        {
            /* ignore */
        }
    }

    private static void TryReadConfigPaths(string filePath, Action<string> addDir, Action<string> addStorePath)
    {
        if (!File.Exists(filePath)) return;
        try
        {
            foreach (string line in File.ReadAllLines(filePath))
            {
                string trimmed = line == null ? "" : line.Trim();
                if (trimmed.Length == 0 || trimmed.StartsWith("#")) continue;
                int colon = trimmed.IndexOf(':');
                if (colon <= 0) continue;
                string key = trimmed.Substring(0, colon).Trim().ToLowerInvariant();
                string value = trimmed.Substring(colon + 1).Trim();
                if (key == "data directory") addDir(value);
                else if (key == "store path") addStorePath(value);
            }
        }
        catch (Exception ex)
        {
            Step("Could not read " + ConfigFileName + ": " + ex.Message);
        }
    }

    /// <summary>Minimal JSON string extractor for flat objects (no nested quotes needed).</summary>
    private static string ExtractJsonString(string json, string key)
    {
        if (string.IsNullOrEmpty(json) || string.IsNullOrEmpty(key)) return null;
        string needle = "\"" + key + "\"";
        int keyIdx = json.IndexOf(needle, StringComparison.OrdinalIgnoreCase);
        if (keyIdx < 0) return null;
        int colon = json.IndexOf(':', keyIdx + needle.Length);
        if (colon < 0) return null;
        int i = colon + 1;
        while (i < json.Length && char.IsWhiteSpace(json[i])) i++;
        if (i >= json.Length) return null;
        if (json[i] == 'n' || json[i] == 'N') return null; // null
        if (json[i] != '"') return null;
        i++;
        var sb = new StringBuilder();
        while (i < json.Length)
        {
            char c = json[i];
            if (c == '\\' && i + 1 < json.Length)
            {
                char n = json[i + 1];
                if (n == '"' || n == '\\' || n == '/')
                {
                    sb.Append(n);
                    i += 2;
                    continue;
                }
                if (n == 'n') { sb.Append('\n'); i += 2; continue; }
                if (n == 'r') { sb.Append('\r'); i += 2; continue; }
                if (n == 't') { sb.Append('\t'); i += 2; continue; }
                sb.Append(n);
                i += 2;
                continue;
            }
            if (c == '"') break;
            sb.Append(c);
            i++;
        }
        string value = sb.ToString().Trim();
        return value.Length == 0 ? null : value;
    }

    private static bool PathsEqual(string a, string b)
    {
        if (string.IsNullOrEmpty(a) || string.IsNullOrEmpty(b)) return false;
        return string.Equals(
            a.TrimEnd(Path.DirectorySeparatorChar, Path.AltDirectorySeparatorChar),
            b.TrimEnd(Path.DirectorySeparatorChar, Path.AltDirectorySeparatorChar),
            StringComparison.OrdinalIgnoreCase
        );
    }

    private static bool IsUnder(string child, string parent)
    {
        if (string.IsNullOrEmpty(child) || string.IsNullOrEmpty(parent)) return false;
        string c = child.TrimEnd(Path.DirectorySeparatorChar, Path.AltDirectorySeparatorChar)
            + Path.DirectorySeparatorChar;
        string p = parent.TrimEnd(Path.DirectorySeparatorChar, Path.AltDirectorySeparatorChar)
            + Path.DirectorySeparatorChar;
        return c.StartsWith(p, StringComparison.OrdinalIgnoreCase);
    }

    private static bool IsUnsafeWipeTarget(string fullPath)
    {
        try
        {
            string root = Path.GetPathRoot(fullPath);
            if (PathsEqual(fullPath, root)) return true;
            string profile = Environment.GetFolderPath(Environment.SpecialFolder.UserProfile);
            if (PathsEqual(fullPath, profile)) return true;
            string docs = Environment.GetFolderPath(Environment.SpecialFolder.MyDocuments);
            if (PathsEqual(fullPath, docs)) return true;
            string desktop = Environment.GetFolderPath(Environment.SpecialFolder.DesktopDirectory);
            if (PathsEqual(fullPath, desktop)) return true;
        }
        catch
        {
            return true;
        }
        return false;
    }

    private static void StopRunningApp()
    {
        Step("Looking for running " + ExeName + " processes…");
        Process[] procs;
        try
        {
            procs = Process.GetProcessesByName(Path.GetFileNameWithoutExtension(ExeName));
        }
        catch (Exception ex)
        {
            Step("Could not enumerate processes (" + ex.Message + "); continuing.");
            return;
        }

        if (procs == null || procs.Length == 0)
        {
            Step("No running " + ExeName + " process found.");
            return;
        }

        foreach (Process p in procs)
        {
            try
            {
                Step("Stopping process id " + p.Id + " (" + p.ProcessName + ")…");
                p.Kill();
                if (!p.WaitForExit(8000))
                {
                    Step("Process " + p.Id + " did not exit within 8s; continuing anyway.");
                }
                else
                {
                    Step("Process " + p.Id + " stopped.");
                }
            }
            catch (Exception ex)
            {
                Step("Could not stop process " + p.Id + ": " + ex.Message);
            }
            finally
            {
                try
                {
                    p.Dispose();
                }
                catch
                {
                    /* ignore */
                }
            }
        }
    }

    private static void RemoveDesktopShortcut(string shortcutPath)
    {
        Step("Checking desktop shortcut: " + shortcutPath);
        if (!File.Exists(shortcutPath))
        {
            Step("Desktop shortcut not found (nothing to remove).");
            return;
        }
        try
        {
            File.Delete(shortcutPath);
            Step("Deleted desktop shortcut.");
        }
        catch (Exception ex)
        {
            Step("Failed to delete desktop shortcut: " + ex.Message);
        }
    }

    private static void RemoveUserData(string userDataDir)
    {
        Step("Removing user data folder: " + userDataDir);
        if (!Directory.Exists(userDataDir))
        {
            Step("User data folder not found (nothing to remove).");
            return;
        }
        try
        {
            Directory.Delete(userDataDir, true);
            Step("Deleted user data folder.");
        }
        catch (Exception ex)
        {
            Step("Failed to delete user data folder: " + ex.Message);
            throw;
        }
    }

    private static void RemoveInstallDirectory(string installDir)
    {
        Step("Preparing to remove install folder: " + installDir);
        if (!Directory.Exists(installDir))
        {
            Step("Install folder not found (nothing to remove).");
            return;
        }

        // Cannot fully delete our own directory while this exe is running from it.
        // Schedule a delayed cmd rmdir after we exit.
        string quoted = installDir.Replace("\"", "");
        string args =
            "/C echo Removing \""
            + quoted
            + "\" … & ping 127.0.0.1 -n 2 >NUL & rmdir /S /Q \""
            + quoted
            + "\" & if exist \""
            + quoted
            + "\" (echo Folder still locked; try deleting manually: \""
            + quoted
            + "\")";

        Step("Scheduling delayed removal of the install folder (after this program exits)…");
        try
        {
            ProcessStartInfo psi = new ProcessStartInfo();
            psi.FileName = "cmd.exe";
            psi.Arguments = args;
            psi.CreateNoWindow = true;
            psi.UseShellExecute = false;
            psi.WindowStyle = ProcessWindowStyle.Hidden;
            Process.Start(psi);
            Step("Scheduled: cmd will delete the install folder momentarily.");
        }
        catch (Exception ex)
        {
            Step("Could not schedule folder removal: " + ex.Message);
            Step("Please delete this folder manually after closing the uninstaller: " + installDir);
            throw;
        }
    }
}
