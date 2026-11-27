# Deployment

De manifests van overload staan **niet** in deze repo maar in
[`x-real-ip/gitops`](https://github.com/x-real-ip/gitops), onder
`manifests/overload/`. Daar kijkt Argo CD naar; manifests hier zouden een
tweede plek zijn om hetzelfde bij te houden.

```
gitops/
├── argocd/apps/overload.yaml          Argo CD Application (namespace tools)
└── manifests/overload/
    ├── base/
    │   ├── cluster.yaml                    CloudNativePG-cluster overload-db
    │   ├── configmap.yaml                  overload-config
    │   ├── sealedsecret.yaml               overload-secrets + overload-db-credentials
    │   ├── deployment.yaml                 initContainer migrate + container app
    │   ├── service.yaml                    poort 80 → 8080
    │   └── httproute.yaml                  fitness.lan.stamx.nl
    └── overlay/kustomization.yaml           namespace + image-tag
```

## Wat waar draait

| Onderdeel     | Wat het is                                              | Volume                                           |
| ------------- | ------------------------------------------------------- | ------------------------------------------------ |
| `overload`    | Fastify: API en de gebouwde PWA in één image, 1 replica, strategy `Recreate` | geen (alle state zit in Postgres) |
| `overload-db` | CloudNativePG `Cluster` (Postgres 18, 1 instance)       | dynamisch via truenas-csi (`truenas-ssd-iscsi`, 5Gi) |

De app is bereikbaar via de `private` gateway (NGINX Gateway Fabric, namespace
`gateway-private`, listener `https`) op `fitness.lan.stamx.nl`. TLS zit op de
gateway (wildcard `*.lan.stamx.nl`). De database is alleen binnen het cluster
bereikbaar, op `overload-db-rw.tools.svc.cluster.local:5432`.

Het `Cluster` heeft `Prune=false,Delete=false`: Argo CD verwijdert de database
nooit, ook niet als de Application weg is.

## Migraties

De migraties draaien als **initContainer** `migrate` in de deployment, uit
dezelfde image als de app:

```
node --disable-warning=ExperimentalWarning server/migrate.ts
```

Dat is hetzelfde als `npm run migrate`. Het commando is idempotent: een tweede
run doet niets en meldt `Database schema is up to date`. Een advisory lock in
Postgres voorkomt dat twee runs tegelijk migreren. De app zelf migreert in het
cluster niet (`MIGRATE_ON_START: "false"`).

Omdat het een initContainer is in een deployment met één replica en
`strategy: Recreate`, kan er nooit meer dan één migratie tegelijk lopen, en
start de app pas als de migratie geslaagd is. Mislukt de migratie, dan blijft
de pod in `Init:Error` hangen. Bij `Recreate` is de vorige versie dan al
gestopt, dus de app is offline tot het opgelost is. Kijk in de logs van de
initContainer:

```bash
kubectl -n tools logs deploy/overload -c migrate
```

## Health

`GET /healthz` geeft `{"status":"ok","database":"ok"}`, of status 503 met
`"database":"error"` als Postgres niet antwoordt. Readiness- en livenessprobe
gebruiken dit endpoint. Het staat buiten `/api` en vraagt nooit om inloggen.

## Uitgaand internet

Alleen nodig voor de AI-provider: `api.anthropic.com` (of het endpoint in
`AI_BASE_URL`, bijvoorbeeld een Ollama in het cluster). Zonder sleutel of
zonder uitgaand internet werkt alles behalve de AI: programma's worden dan
regelgebaseerd opgebouwd en de coach toont berekende feiten uit je historie.

Voor OIDC praat de app met `auth.lan.stamx.nl`. Dat certificaat komt van de
interne Stamx CA. De deployment mount ConfigMap `stamx-ca` op
`/etc/ssl/stamx/ca.crt` en zet `NODE_EXTRA_CA_CERTS` daarop. De mount is
`optional`: ontbreekt de ConfigMap, dan start de app gewoon, maar OIDC-login
faalt dan op het certificaat.

## Rechten

De app draait als uid/gid 3001 (aangemaakt in de `Dockerfile`). De
`securityContext` van de pod zet `runAsUser`, `runAsGroup` en `fsGroup` op 3001.
De app schrijft niets naar schijf.

## Secrets

`overload-secrets` bevat:

| Sleutel              | Verplicht | Wat                                                      |
| -------------------- | --------- | -------------------------------------------------------- |
| `DATABASE_URL`       | ja        | `postgres://overload:<wachtwoord>@overload-db-rw.tools.svc.cluster.local:5432/overload` |
| `SESSION_SECRET`     | ja        | ondertekent de sessiecookie                              |
| `APP_PASSWORD`       | ja zolang `AUTH_MODE` `password` is | het inlogwachtwoord           |
| `ANTHROPIC_API_KEY`  | nee       | zonder sleutel geen AI                                   |
| `OIDC_CLIENT_SECRET` | nee       | nodig bij `AUTH_MODE: oidc`                              |

`overload-db-credentials` (type `kubernetes.io/basic-auth`) bevat `username` en
`password` van de databasegebruiker. CNPG maakt daarmee de database en de rol
`overload` aan (`bootstrap.initdb`) en houdt het wachtwoord van die rol gelijk
aan het secret (`managed.roles`).

Beide zijn SealedSecrets met scope `cluster-wide`. De platte waardes staan
nergens in een repo. Eén nieuwe waarde verzegelen:

```bash
printf '%s' 'de-nieuwe-waarde' > /tmp/w
kubeseal --controller-name sealed-secrets --controller-namespace kube-system \
  --scope cluster-wide --raw --from-file=/tmp/w
rm /tmp/w
```

Let op: `printf '%s'` en niet `echo`, anders komt er een newline in de waarde
terecht en klopt het wachtwoord niet meer. De controller heet `sealed-secrets`
in `kube-system`, niet de standaardnaam van kubeseal; zonder die vlaggen faalt
het commando. Zonder toegang tot het cluster: `--cert <bestand>` met het
certificaat van `kubeseal … --fetch-cert`. Gebruik een vers opgehaald
certificaat: de controller vernieuwt zijn sleutel, en `sealed-secret-tls-2.crt`
is niet meer het actuele certificaat.

Wijzig je het wachtwoord in `overload-db-credentials`, dan moet `DATABASE_URL`
mee: daar staat hetzelfde wachtwoord in.

## Een release uitrollen

1. Merge naar `main`. De workflow bouwt dan `ghcr.io/x-real-ip/overload:latest`
   en een `sha-…`-tag, maar rolt niets uit.
2. Publiceer de release die release-drafter heeft klaargezet (of maak een tag
   `v1.2.3`). De workflow bouwt dan `ghcr.io/x-real-ip/overload:1.2.3`.
3. Job `deploy-release` stuurt een `repository_dispatch` (`update-manifest`)
   naar `x-real-ip/gitops`. Die repo zet `newTag: 1.2.3` in
   `manifests/overload/overlay/kustomization.yaml` en commit dat op `main`.
4. Argo CD synct: de pod wordt vervangen, de initContainer migreert, daarna
   start de nieuwe versie.

Controleren:

```bash
kubectl -n tools get pods -l app=overload
kubectl -n tools port-forward deploy/overload 8080:8080
curl -s localhost:8080/healthz    # {"status":"ok","database":"ok"}
curl -s localhost:8080/api/info   # bevat "version":"1.2.3"
```

Terugrollen: zet `newTag` in de overlay terug via een PR in de gitops-repo.
Migraties zijn alleen vooruit; een oudere versie draait op een nieuwer schema
zolang de migratie alleen iets toevoegde (zoals tot nu toe steeds).

## Handmatige dump

```bash
kubectl -n tools exec overload-db-1 -- pg_dump -Fc -U postgres overload > overload.dump
```

Terugzetten in een lege database kan met `pg_restore` op dezelfde manier
(`kubectl exec -i … pg_restore --clean --if-exists -U postgres -d overload < overload.dump`),
met de app eerst op 0 replicas. De app-export (Profile → Data → JSON) is een
tweede, database-onafhankelijke kopie.
