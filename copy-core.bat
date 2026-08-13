@echo off
chcp 65001 >nul
echo ========================================
echo   拼豆小游戏 - 核心脚本同步工具
echo ========================================
echo.

set "PROJECT_DIR=%~dp0"

echo [信息] 复制 shared-game-core.js 到微信版...
copy /Y "%PROJECT_DIR%shared-game-core.js" "%PROJECT_DIR%wechat-game\shared-game-core.js" >nul
if %errorlevel% equ 0 ( echo [成功] wechat-game/shared-game-core.js ) else ( echo [失败] 复制失败 )

echo [信息] 复制 shared-game-core.js 到抖音版...
copy /Y "%PROJECT_DIR%shared-game-core.js" "%PROJECT_DIR%douyin-game\shared-game-core.js" >nul
if %errorlevel% equ 0 ( echo [成功] douyin-game/shared-game-core.js ) else ( echo [失败] 复制失败 )

echo.
echo ========================================
echo [完成] 核心脚本同步成功！
echo   修改 shared-game-core.js 后运行此脚本同步
echo.
pause