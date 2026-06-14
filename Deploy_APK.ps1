# Deploy_APK.ps1
# Script para CineQuest: Roda o git c/ timestamp e pergunta qual build gerar.
# Removidos acentos para evitar problemas de codificacao no Windows.

Clear-Host
$host.UI.RawUI.WindowTitle = "CineQuest Mobile Deploy"

Write-Host "==========================================" -ForegroundColor Yellow
Write-Host "=     CINEQUEST MOBILE - DEPLOY MASTER   =" -ForegroundColor Yellow
Write-Host "==========================================" -ForegroundColor Yellow

# 1. VERIFICAR PASTA
$currentDirName = Split-Path -Leaf (Get-Location)
if ($currentDirName -ne "CineQuest") {
    if (Test-Path "CineQuest") {
        Write-Host " Entrando na pasta 'CineQuest'..." -ForegroundColor Cyan
        Set-Location "CineQuest"
    } else {
        Write-Host " Assumindo execucao na raiz do projeto." -ForegroundColor DarkGray
    }
}

# 2. BUILD INTERATIVO
Write-Host "`n[1/2] Selecao de Build" -ForegroundColor Cyan
Write-Host "Escolha o tipo de build que deseja gerar:"
Write-Host " [1] Producao (Gera .aab para Google Play Console) -> COM AUTO-GIT" -ForegroundColor Green
Write-Host " [2] Homologacao (Gera .apk para instalacao direta / Testes)" -ForegroundColor Magenta
Write-Host " [3] Desenvolvimento (Dev Client - Para npx expo start)" -ForegroundColor Cyan
Write-Host " [4] Rodar Local (npx expo start --clear --dev-client)" -ForegroundColor Blue
Write-Host " [5] Apenas Git (Pular Build)" -ForegroundColor Gray

$selection = Read-Host "`nDigite o numero e de Enter"

# 3. GIT AUTOMATION (Apenas para opcao 1 e 5)
if ($selection -eq "1" -or $selection -eq "5") {
    Write-Host "`n[Git Automation] Executando por ser opcao $selection..." -ForegroundColor Cyan
    $timestamp = Get-Date -Format "yyyyMMdd-HHmm"
    $commitMsg = "msg: $timestamp"

    # 3.1 Garantir configuracao do Remote do GitHub
    $remoteCheck = git remote
    if ($remoteCheck -notcontains "origin") {
        Write-Host " -> Adicionando remote origin (lucianogar/CineQuest)..." -NoNewline
        git remote add origin "https://github.com/lucianogar/CineQuest.git"
        git branch -M main
        Write-Host " OK" -ForegroundColor Green
    }

    Write-Host " -> Adicionando arquivos..." -NoNewline
    git add .
    Write-Host " OK" -ForegroundColor Green

    Write-Host " -> Commitando ($commitMsg)..." -NoNewline
    git commit -m "$commitMsg" 2>&1 | Out-Null
    if ($LASTEXITCODE -eq 0) {
        Write-Host " OK" -ForegroundColor Green
    } else {
        Write-Host " (Nada para commitar)" -ForegroundColor Yellow
    }

    Write-Host " -> Enviando para GitHub..." -NoNewline
    # Pega a branch atual para enviar de forma assertiva
    $currentBranch = git branch --show-current
    if ([string]::IsNullOrEmpty($currentBranch)) { $currentBranch = "main" }
    
    git push -u origin $currentBranch 2>&1 | Out-Null
    if ($LASTEXITCODE -eq 0) {
        Write-Host " OK" -ForegroundColor Green
    } else {
        Write-Host " ERRO!" -ForegroundColor Red
        Write-Host " Verifique suas credenciais, SSH/Token ou conexao."
        # Como e producao ou git-only, se falhar o push, paramos.
        exit
    }
}

# 4. EXECUCAO DO BUILD
switch ($selection) {
    "1" {
        Write-Host "`n[2/2] Iniciando Build de PRODUCAO..." -ForegroundColor Green
        eas build -p android --profile production
    }
    "2" {
        Write-Host "`n[2/2] Iniciando Build de HOMOLOGACAO..." -ForegroundColor Magenta
        eas build -p android --profile preview
    }
    "3" {
        Write-Host "`n[2/2] Iniciando Build de DESENVOLVIMENTO (Dev Client)..." -ForegroundColor Cyan
        eas build -p android --profile development
    }
    "4" {
        Write-Host "`n[2/2] Iniciando Servidor Local..." -ForegroundColor Blue
        npx expo start --clear --dev-client
    }
    "5" {
        Write-Host "`n[2/2] Build pulado. Git atualizado com sucesso." -ForegroundColor Green
    }
    Default {
        Write-Host "`nOpcao invalida." -ForegroundColor Yellow
    }
}

Write-Host "`n==========================================" -ForegroundColor Yellow
Write-Host "          PROCESSO CONCLUIDO              " -ForegroundColor Yellow
Write-Host "==========================================" -ForegroundColor Yellow
Read-Host "Pressione Enter para fechar..."
