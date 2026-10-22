// Strank offline uninstaller (console). Built into uninstall.exe by scripts/build-uninstall.js.
// Icon: Unranked badge (generated at build time from data/badges/unranked.svg colors).

using System;
using System.Diagnostics;
using System.IO;
using System.Threading;

internal static class Program
{
    private const string AppName = "Strank";
    private const string UserDataFolderName = "Strank";
    private const string ShortcutName = "Strank.lnk";
    private const string ExeName = "Strank.exe";

    private static int Main(string[] args)
    {
        Console.Title = AppName + " Uninstaller";
        try
        {
            Console.OutputEncoding = System.Text.Encoding.UTF8;
        }
        catch
        {
            /* ignore */
        }

        string installDir = Path.GetFullPath(AppDomain.CurrentDomain.BaseDirectory)
            .TrimEnd(Path.DirectorySeparatorChar, Path.AltDirectorySeparatorChar);
        string userDataDir = Path.Combine(
            Environment.GetFolderPath(Environment.SpecialFolder.ApplicationData),
            UserDataFolderName
        );
        string desktopShortcut = Path.Combine(
            Environment.GetFolderPath(Environment.SpecialFolder.DesktopDirectory),
            ShortcutName
        );

        Console.WriteLine();
        Console.WriteLine("=== " + AppName + " Uninstaller ===");
        Console.WriteLine();
        Console.WriteLine("Install folder:  " + installDir);
        Console.WriteLine("User data folder: " + userDataDir);
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
            Step("Option 1 selected: remove all traces (install files + user data + shortcut).");
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
                RemoveUserData(userDataDir);
            }
            else
            {
                Step("Keeping user data folder: " + userDataDir);
                if (Directory.Exists(userDataDir))
                {
                    Step("Confirmed user data still present (not deleted).");
                }
                else
                {
                    Step("User data folder was already absent.");
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
