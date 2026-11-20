// Runs after electron-builder packs the app. Puts OUR icon and product name into the Windows .exe
// (works on any OS, no wine needed), so Explorer, the taskbar, shortcuts and Task Manager don't show Electron.
const fs = require('node:fs');
const path = require('node:path');

exports.default = async function afterPack(context) {
  if (context.electronPlatformName !== 'win32') return;
  const ResEdit = require('resedit');
  const exeName = `${context.packager.appInfo.productFilename}.exe`;
  const exePath = path.join(context.appOutDir, exeName);
  const icoPath = path.join(context.packager.projectDir, 'build', 'icon.ico');
  const exe = ResEdit.NtExecutable.from(fs.readFileSync(exePath), { ignoreCert: true });
  const res = ResEdit.NtExecutableResource.from(exe);

  const ico = ResEdit.Data.IconFile.from(fs.readFileSync(icoPath));
  const groups = ResEdit.Resource.IconGroupEntry.fromEntries(res.entries);
  const group = groups[0] || { id: 1, lang: 1033 };
  ResEdit.Resource.IconGroupEntry.replaceIconsForResource(res.entries, group.id, group.lang, ico.icons.map((i) => i.data));

  const info = context.packager.appInfo, ver = info.version.split('.').map(Number);
  const vi = ResEdit.Resource.VersionInfo.fromEntries(res.entries)[0];
  if (vi) {
    vi.setFileVersion(ver[0] || 1, ver[1] || 0, ver[2] || 0, 0, vi.lang);
    vi.setProductVersion(ver[0] || 1, ver[1] || 0, ver[2] || 0, 0, vi.lang);
    vi.setStringValues({ lang: vi.lang, codepage: 1200 }, {
      ProductName: info.productName, FileDescription: info.productName, InternalName: info.productName,
      OriginalFilename: exeName, CompanyName: 'Muhammad Hamim', LegalCopyright: `Copyright © ${new Date().getFullYear()} Muhammad Hamim`,
    });
    vi.outputToResourceEntries(res.entries);
  }
  res.outputResource(exe);
  fs.writeFileSync(exePath, Buffer.from(exe.generate()));
  console.log(`  • patched ${exeName}: app icon + product name embedded`);
};
