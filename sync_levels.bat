@echo off
chcp 65001 >nul
echo ========================================
echo   拼豆小游戏 - 关卡同步工具
echo ========================================
echo.

set "SOURCE=%USERPROFILE%\Downloads\published_levels.json"
set "PROJECT_DIR=%~dp0"

if not exist "%SOURCE%" (
    echo [错误] 未找到 published_levels.json
    echo.
    echo 请先在 PC 管理端点击"发布关卡"下载该文件。
    echo.
    pause
    exit /b 1
)

echo [信息] 找到关卡数据文件
echo.

echo [信息] 复制到微信版...
copy /Y "%SOURCE%" "%PROJECT_DIR%wechat-game\published_levels.json" >nul
if %errorlevel% equ 0 ( echo [成功] wechat-game/published_levels.json ) else ( echo [失败] 复制失败 )

echo [信息] 复制到抖音版...
copy /Y "%SOURCE%" "%PROJECT_DIR%douyin-game\published_levels.json" >nul
if %errorlevel% equ 0 ( echo [成功] douyin-game/published_levels.json ) else ( echo [失败] 复制失败 )

echo.
echo ========================================
echo [完成] 同步成功！
echo.
echo 接下来请在开发者工具中按 Ctrl+R 重新编译
echo.
pause
