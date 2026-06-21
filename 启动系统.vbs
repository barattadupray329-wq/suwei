Set shell = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")
projectDir = fso.GetParentFolderName(WScript.ScriptFullName)
scriptPath = Chr(34) & projectDir & "\main.py" & Chr(34)

shell.CurrentDirectory = projectDir
On Error Resume Next
shell.Run "pyw -3 " & scriptPath, 0, False
If Err.Number <> 0 Then
    Err.Clear
    shell.Run "pythonw " & scriptPath, 0, False
End If
On Error GoTo 0
