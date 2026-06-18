$shell = New-Object -ComObject WScript.Shell
$link = $shell.CreateShortcut('C:\Users\Administrator\Desktop\speed_rental_v2.lnk')
$link.TargetPath = 'C:\Python310\python.exe'
$link.Arguments = 'D:\Python项目\速维电脑租赁管理系统_v2\versions\standalone\main.py'
$link.WorkingDirectory = 'D:\Python项目\速维电脑租赁管理系统_v2'
$link.Save()
Write-Host 'Shortcut created'
