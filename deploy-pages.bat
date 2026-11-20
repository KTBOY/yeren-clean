@echo off
chcp 65001 >nul
setlocal
cd /d "%~dp0"

echo [1/4] 正在构建生产版本...
call pnpm build
if errorlevel 1 goto fail

echo [2/4] 正在准备部署目录...
set "DEPLOY_DIR=%TEMP%\yeren-clean-gh-pages"
if exist "%DEPLOY_DIR%" rmdir /s /q "%DEPLOY_DIR%"
mkdir "%DEPLOY_DIR%" || goto fail
xcopy "dist\*" "%DEPLOY_DIR%\" /E /I /Y /Q >nul
if errorlevel 1 goto fail

echo [3/4] 正在推送 gh-pages 分支...
cd /d "%DEPLOY_DIR%"
git init -b gh-pages -q
git add -A
git -c user.name="KTBOY" -c user.email="KTBOY@users.noreply.github.com" commit -q -m "Deploy game build"
if errorlevel 1 goto fail
git remote add origin https://github.com/KTBOY/yeren-clean.git
git push -f -q origin gh-pages
if errorlevel 1 goto fail

echo [4/4] 完成！访问 https://ktboy.github.io/yeren-clean/
cd /d "%~dp0"
rmdir /s /q "%DEPLOY_DIR%" >nul 2>&1
echo.
pause
exit /b 0

:fail
echo 部署失败，请检查上面的错误信息。
cd /d "%~dp0"
pause
exit /b 1
