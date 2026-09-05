# Actualización automática desde tu máquina

`natura.com.co` responde 403 a toda IP de datacenter, así que el workflow de
GitHub no puede traer las fotos de Natura. Una máquina con conexión residencial
colombiana sí. Esto la convierte en la que mantiene el catálogo al día, sola.

## Por qué una tarea programada y no un *self-hosted runner*

Un runner de GitHub Actions existe para que **GitHub le mande trabajo a tu
máquina**. Eso abre una puerta hacia adentro, y con este repositorio **público**
esa puerta la puede empujar cualquiera: quien sea puede hacer un fork, abrir un
PR y hacer que su código corra en tu computador. GitHub lo desaconseja
explícitamente para repos públicos, y no es una tecnicidad — es el modo de fallo
conocido de esa configuración.

Una tarea programada hace lo mismo sin abrir nada: tu máquina sale a internet,
trae los datos y empuja una rama. Solo conexiones salientes. Nada entra.

Si algún día el repositorio pasa a privado, el runner deja de ser un problema y
se puede reconsiderar. Mientras sea público, no.

## Qué hace

```bash
node scripts/actualizar-campana.mjs --auto
```

1. Comprueba que la máquina alcance `yanbal.com` y `natura.com.co`. Si no, para
   ahí y lo dice — no deja datos a medias.
2. Busca si hay campaña nueva. Si no hay, termina sin hacer nada.
3. Corre el pipeline completo de las marcas que tengan novedad.
4. Compara la cobertura contra la campaña vigente.
5. **Si la cobertura pasó**, empuja una rama `datos/campana-AAAAMMDD`.
   **Si cayó, no empuja nada** y se reintenta en la siguiente corrida.

Nunca empuja a `main` y nunca mergea. Lo que se publica lo decides tú, porque
las marcas sacan la campaña siguiente antes de que entre en vigencia: mergear
apenas aparece pondría en el sitio precios que todavía no rigen.

## Antes de programarla

Corre esto una vez a mano, para ver que la máquina alcanza las dos marcas:

```bash
npm run campana:detectar
```

Y comprueba que `git push` funcione sin pedir contraseña (llave SSH o
credencial guardada). Una tarea programada no puede escribir una contraseña.

## macOS y Linux (cron)

`crontab -e` y añade — todos los días a las 7:00:

```cron
0 7 * * * cd /ruta/a/Calculator && /usr/local/bin/node scripts/actualizar-campana.mjs --auto >> /tmp/alejandria.log 2>&1
```

Usa la ruta absoluta de `node` (`which node`): cron no hereda tu `PATH`.

En macOS, la primera vez el sistema puede pedir permiso para que `cron` acceda a
carpetas — acéptalo o la tarea fallará en silencio.

## Windows (Programador de tareas)

```powershell
$accion  = New-ScheduledTaskAction -Execute "node" `
    -Argument "scripts\actualizar-campana.mjs --auto" `
    -WorkingDirectory "C:\ruta\a\Calculator"
$disparo = New-ScheduledTaskTrigger -Daily -At 7am

Register-ScheduledTask -TaskName "Alejandria - campana" `
    -Action $accion -Trigger $disparo -Description "Actualiza el catálogo"
```

Marca *"Ejecutar tanto si el usuario inició sesión como si no"* si quieres que
corra con la sesión cerrada.

## Cuándo revisar

La tarea es silenciosa a propósito: si no hay campaña nueva, no hace nada, y
avisar de eso todos los días entrena a ignorar los avisos. Lo que sí conviene:

- Cuando llegue una rama `datos/campana-*`, revísala y ábrele PR.
- Si pasa una semana desde que sabes que cambió la campaña y no llegó ninguna
  rama, mira el log: `tail -50 /tmp/alejandria.log`.

## Qué sigue haciendo falta a mano

La tarea trae los datos. No decide:

- Actualizar la campaña y su vigencia en `lib/negocio.ts` — el texto de vigencia
  no se extrae de ninguna fuente, hay que leerlo de la revista.
- Cuándo mergear. Ver arriba.
