# Servidor local do Nosso Mes.
# Mostra os arquivos do projeto no navegador (http://localhost:5500) e avisa o app
# quando algum arquivo muda, pra ele recarregar sozinho (live reload).
param([switch]$SemNavegador)

$raiz = $PSScriptRoot
$tipos = @{
  '.html' = 'text/html; charset=utf-8'
  '.css'  = 'text/css; charset=utf-8'
  '.js'   = 'text/javascript; charset=utf-8'
  '.mjs'  = 'text/javascript; charset=utf-8'
  '.json' = 'application/json; charset=utf-8'
  '.webmanifest' = 'application/manifest+json'
  '.csv'  = 'text/csv; charset=utf-8'
  '.svg'  = 'image/svg+xml'
  '.png'  = 'image/png'
  '.jpg'  = 'image/jpeg'
  '.ico'  = 'image/x-icon'
  '.pdf'  = 'application/pdf'
  '.woff2' = 'font/woff2'
}

# Liga na primeira porta livre entre 5500 e 5510
$servidor = $null
foreach ($porta in 5500..5510) {
  $tentativa = New-Object System.Net.HttpListener
  $tentativa.Prefixes.Add("http://localhost:$porta/")
  try { $tentativa.Start(); $servidor = $tentativa; break } catch { $tentativa.Close() }
}
if (-not $servidor) {
  Write-Host 'Nao consegui ligar o servidor: as portas 5500 a 5510 estao ocupadas.'
  Read-Host 'Aperte Enter para fechar'
  exit 1
}

$endereco = "http://localhost:$porta/"
Write-Host ''
Write-Host '  Nosso Mes esta rodando!'
Write-Host "  Preview: ${endereco}preview.html"
Write-Host "  App:     $endereco"
Write-Host ''
Write-Host '  Para desligar, e so fechar esta janela.'
if (-not $SemNavegador) { Start-Process "${endereco}preview.html" }

# "Versao" do projeto: muda sempre que algum arquivo e salvo, criado ou apagado
function Get-Versao {
  $arquivos = @(Get-ChildItem -LiteralPath $raiz -Recurse -File)
  $ultimo = $arquivos | Sort-Object LastWriteTimeUtc -Descending | Select-Object -First 1
  "$($ultimo.LastWriteTimeUtc.Ticks)-$($arquivos.Count)"
}

while ($servidor.IsListening) {
  $contexto = $servidor.GetContext()
  $resposta = $contexto.Response
  try {
    $resposta.Headers.Add('Cache-Control', 'no-store')
    $caminho = [Uri]::UnescapeDataString($contexto.Request.Url.AbsolutePath)

    if ($caminho -eq '/__versao') {
      $resposta.ContentType = 'text/plain; charset=utf-8'
      $bytes = [Text.Encoding]::UTF8.GetBytes((Get-Versao))
    } else {
      if ($caminho.EndsWith('/')) { $caminho += 'index.html' }
      $arquivo = [IO.Path]::GetFullPath((Join-Path $raiz $caminho.TrimStart('/')))
      if ($arquivo.StartsWith($raiz + '\') -and [IO.File]::Exists($arquivo)) {
        $extensao = [IO.Path]::GetExtension($arquivo).ToLower()
        $resposta.ContentType = if ($tipos[$extensao]) { $tipos[$extensao] } else { 'application/octet-stream' }
        $bytes = [IO.File]::ReadAllBytes($arquivo)
      } else {
        $resposta.StatusCode = 404
        $resposta.ContentType = 'text/plain; charset=utf-8'
        $bytes = [Text.Encoding]::UTF8.GetBytes('Nao encontrado')
      }
    }

    $resposta.ContentLength64 = $bytes.Length
    $resposta.OutputStream.Write($bytes, 0, $bytes.Length)
  } catch {
    # Navegador fechou a conexao no meio: sem problema, segue o baile
  } finally {
    $resposta.Close()
  }
}
