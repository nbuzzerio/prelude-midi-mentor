@echo off
setlocal

REM Run from the repository root, even though this file lives in .dev.
cd /d "%~dp0.."
set "REPO_ROOT=%cd%"
set "SAFE_REPO=%REPO_ROOT:\=/%"

set "OUTPUT=.dev\_git-diff.txt"

(
  echo Prelude Git Review
  echo Generated: %date% %time%
  echo Repository: %cd%
  echo.

  echo ============================================================
  echo GIT STATUS
  echo ============================================================
  git -c safe.directory=%SAFE_REPO% status --short
  echo.

  echo ============================================================
  echo UNSTAGED DIFF STAT
  echo ============================================================
  git -c safe.directory=%SAFE_REPO% diff --stat
  echo.

  echo ============================================================
  echo UNSTAGED DIFF
  echo ============================================================
  git -c safe.directory=%SAFE_REPO% diff --no-color
  echo.

  echo ============================================================
  echo UNTRACKED FILES
  echo ============================================================
  for /f "delims=" %%F in ('git -c safe.directory^=%SAFE_REPO% ls-files --others --exclude-standard') do (
    echo.
    echo ------------------------------------------------------------
    echo UNTRACKED FILE: %%F
    echo ------------------------------------------------------------
    git -c safe.directory=%SAFE_REPO% diff --no-index --no-color -- NUL "%%F"
  )
  echo.

  echo ============================================================
  echo STAGED DIFF STAT
  echo ============================================================
  git -c safe.directory=%SAFE_REPO% diff --cached --stat
  echo.

  echo ============================================================
  echo STAGED DIFF
  echo ============================================================
  git -c safe.directory=%SAFE_REPO% diff --cached --no-color
) > "%OUTPUT%" 2>&1

if errorlevel 1 (
  echo Failed to generate Git review at %OUTPUT% 1>&2
  endlocal & exit /b 1
)

echo Git review written to %OUTPUT%

if /i "%~1"=="--no-open" (
  endlocal & exit /b 0
)

where code >nul 2>&1
if %errorlevel% equ 0 (
  code --reuse-window "%OUTPUT%"
)

endlocal
