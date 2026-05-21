!macro NSIS_HOOK_PREINSTALL
  DetailPrint "Stopping running JustHireMe processes before upgrade..."
  nsExec::ExecToLog '"$SYSDIR\taskkill.exe" /IM justhireme.exe /T /F'
  nsExec::ExecToLog '"$SYSDIR\taskkill.exe" /IM jhm-sidecar-next.exe /T /F'
  nsExec::ExecToLog '"$SYSDIR\taskkill.exe" /IM backend.exe /T /F'
  Sleep 2000

  ClearErrors
  Delete "$INSTDIR\jhm-sidecar-next.exe"
  Delete "$INSTDIR\jhm-sidecar-next*.exe"
  Delete "$INSTDIR\backend.exe"
  RMDir /r "$INSTDIR\_internal"
  RMDir /r "$INSTDIR\resources\sidecar-internal"
  RMDir /r "$INSTDIR\resources\backend\_internal"
  DetailPrint "Retrying bundled backend cleanup..."
  Sleep 1500
  ClearErrors
  Delete "$INSTDIR\jhm-sidecar-next.exe"
  Delete "$INSTDIR\jhm-sidecar-next*.exe"
  Delete "$INSTDIR\backend.exe"
  RMDir /r "$INSTDIR\_internal"
  RMDir /r "$INSTDIR\resources\sidecar-internal"
  RMDir /r "$INSTDIR\resources\backend\_internal"
  Sleep 2500
  ClearErrors
  Delete "$INSTDIR\jhm-sidecar-next.exe"
  Delete "$INSTDIR\jhm-sidecar-next*.exe"
  Delete "$INSTDIR\backend.exe"
  RMDir /r "$INSTDIR\_internal"
  RMDir /r "$INSTDIR\resources\sidecar-internal"
  RMDir /r "$INSTDIR\resources\backend\_internal"
  DetailPrint "Bundled backend cleanup complete."
!macroend

!macro NSIS_HOOK_POSTINSTALL
  DetailPrint "Repairing JustHireMe Windows install metadata..."
  SetShellVarContext current

  WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\JustHireMe" "DisplayName" "JustHireMe"
  WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\JustHireMe" "InstallLocation" "$INSTDIR"
  WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\JustHireMe" "DisplayIcon" "$INSTDIR\justhireme.exe"
  WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\JustHireMe" "UninstallString" '"$INSTDIR\uninstall.exe"'
  WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\JustHireMe" "QuietUninstallString" '"$INSTDIR\uninstall.exe" /S'

  CreateDirectory "$SMPROGRAMS"
  CreateShortCut "$SMPROGRAMS\JustHireMe.lnk" "$INSTDIR\justhireme.exe" "" "$INSTDIR\justhireme.exe" 0 SW_SHOWNORMAL "" "JustHireMe"

  IfFileExists "$DESKTOP\JustHireMe.lnk" 0 +2
    CreateShortCut "$DESKTOP\JustHireMe.lnk" "$INSTDIR\justhireme.exe" "" "$INSTDIR\justhireme.exe" 0 SW_SHOWNORMAL "" "JustHireMe"

  IfFileExists "$APPDATA\Microsoft\Internet Explorer\Quick Launch\User Pinned\TaskBar\JustHireMe.lnk" 0 +2
    CreateShortCut "$APPDATA\Microsoft\Internet Explorer\Quick Launch\User Pinned\TaskBar\JustHireMe.lnk" "$INSTDIR\justhireme.exe" "" "$INSTDIR\justhireme.exe" 0 SW_SHOWNORMAL "" "JustHireMe"

  DetailPrint "JustHireMe Windows install metadata repaired."
!macroend
