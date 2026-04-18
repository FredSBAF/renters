# Chandra OCR dans l’analyzer PourAccord

Documentation de référence pour **Tesseract**, **Chandra (datalab-to)** et le mode **comparaison**, plus le **serveur vLLM** attendu par Chandra.

- Dépôt upstream : [github.com/datalab-to/chandra](https://github.com/datalab-to/chandra)
- Modèle Hugging Face utilisé par défaut : `datalab-to/chandra-ocr-2`

---

## 1. Rôle dans le projet

Le module [`ocr_extract.py`](ocr_extract.py) peut extraire le texte des PDF / images avec :

| Moteur | Commande / env | Usage |
|--------|----------------|--------|
| **Tesseract** | `OCR_ENGINE=tesseract` (défaut) | Léger, pas de GPU, baseline historique. |
| **Chandra** | `OCR_ENGINE=chandra` | Mise en page riche (markdown), nécessite **vLLM** (serveur) ou **HF** (local lourd). |
| **Les deux** | `OCR_ENGINE=both` | Lance Tesseract **et** Chandra ; résultats comparés dans la réponse JSON. |

Fichiers concernés :

- [`ocr_extract.py`](ocr_extract.py) — routage des moteurs, CLI `--ocr-engine`, `--ocr-primary`
- [`ocr_chandra.py`](ocr_chandra.py) — appel à l’API Chandra (`InferenceManager`, lots de pages)
- Scripts : [`run/run_training_ocr.py`](run/run_training_ocr.py), [`run/run_training_parse.py`](run/run_training_parse.py)

Dépendance Python : `chandra-ocr>=0.2.0` (voir [`requirements.txt`](requirements.txt)).

---

## 2. Installation Python

Depuis la racine du dossier `analyzer` :

```bash
python3 -m pip install -r requirements.txt
```

Vérifier que **le même interpréteur** est utilisé pour `pip` et pour lancer les scripts :

```bash
which python3
python3 -c "import chandra; print('OK')"
```

Si `No module named 'chandra'`, installer avec **`python3 -m pip`** (pas un autre `pip`).

### Option poids lourd (sans vLLM, GPU local)

Pour inférence **Hugging Face** locale (torch, transformers) :

```bash
python3 -m pip install 'chandra-ocr[hf]'
```

Ensuite `CHANDRA_METHOD=hf`. Prévoir une **GPU NVIDIA** et beaucoup de VRAM selon le modèle.

---

## 3. Choisir le moteur

### Variables d’environnement

| Variable | Valeurs | Description |
|----------|---------|-------------|
| `OCR_ENGINE` | `tesseract`, `chandra`, `both` | Moteur(s) utilisé(s). |
| `OCR_PRIMARY` | `tesseract`, `chandra` | Si `both`, indique quel résultat remplit `data.raw_text` (l’autre reste dans `data.compare`). Défaut : `tesseract`. |

### Ligne de commande (`ocr_extract.py`)

```bash
python3 ocr_extract.py --file document.pdf --ocr-engine chandra
python3 ocr_extract.py --file document.pdf --ocr-engine both --ocr-primary tesseract
```

Les arguments CLI **outrepassent** les variables d’environnement pour cet appel.

### Sortie JSON (mode `both`)

- `data.raw_text` : texte du moteur primaire (ou repli sur l’autre moteur si le primaire échoue, avec warning `PRIMARY_OCR_FAILED_FALLBACK`).
- `data.compare.tesseract` / `data.compare.chandra` : détails par moteur (`success`, `raw_text`, scores, erreurs).
- `confidence_score` côté Chandra : souvent `null` (pas d’équivalent Tesseract).

---

## 4. Chandra + vLLM (recommandé en prod avec GPU)

Chandra en mode **`vllm`** envoie les requêtes vers un serveur **compatible OpenAI** (souvent vLLM), pas vers Anthropic.

### 4.1 Prérequis matériels / logiciels

- **Linux + GPU NVIDIA** (Mac sans GPU NVIDIA : pas adapté au conteneur vLLM officiel du projet ; voir §6).
- **Docker** avec support GPU ([NVIDIA Container Toolkit](https://docs.nvidia.com/datacenter/cloud-native/container-toolkit/install-guide.html)).

### 4.2 Lancer le serveur

Une fois `chandra-ocr` installé :

```bash
chandra_vllm --gpu 4090
```

Remplacer `4090` par un profil proche de la carte (`h100`, `a100`, `3090`, `l4`, `t4`, etc.) — voir `chandra_vllm --help`.

Cela démarre typiquement une image du type `vllm/vllm-openai`, expose le port **8000**, et sert le checkpoint **`datalab-to/chandra-ocr-2`**. Le **premier** téléchargement du modèle peut être long.

### 4.3 Variables côté client (ton script / `local.env`)

Chandra lit la config via **variables d’environnement** ou un fichier **`local.env`** à la racine du dépôt Chandra / répertoire courant (comportement du package `chandra.settings`).

À définir pour coller au serveur :

| Variable | Défaut usuel | Rôle |
|----------|----------------|------|
| `CHANDRA_METHOD` | `vllm` | Doit rester `vllm` pour ce flux. |
| `VLLM_API_BASE` | `http://localhost:8000/v1` | URL de base API OpenAI-compatible (**avec** `/v1`). |
| `VLLM_MODEL_NAME` | `chandra` | Nom du modèle **tel qu’exposé** par le serveur (`served-model-name`). |
| `VLLM_GPUS` | `0` | Utilisé surtout par **`chandra_vllm`** pour `docker run --gpus`. |

Vérification rapide :

```bash
curl -s http://localhost:8000/v1/models
```

### 4.4 Options avancées (wrapper `ocr_chandra.py`)

Variables optionnelles prises en charge dans notre wrapper :

- `CHANDRA_PAGE_RANGE` — plage de pages PDF (ex. `1-5,7`)
- `MAX_OUTPUT_TOKENS` — plafond de sortie par page
- `CHANDRA_INCLUDE_IMAGES` — `0` / `false` pour désactiver l’extraction d’images dans la sortie
- `CHANDRA_INCLUDE_HEADERS_FOOTERS` — en-têtes / pieds de page
- `CHANDRA_MAX_WORKERS`, `CHANDRA_MAX_RETRIES` — pour le client vLLM

---

## 5. Scripts d’entraînement / batch

```bash
python3 run/run_training_ocr.py --dir training --ocr-engine both --ocr-primary tesseract
python3 run/run_training_parse.py --dir training --ocr-engine chandra
```

En mode `--use-cli`, les mêmes flags sont transmis à `ocr_extract.py`.

---

## 6. Mac, pas de GPU, ou erreurs réseau

- **Pas de NVIDIA local** : ne pas compter sur `chandra_vllm` sur la machine ; préférer une **machine Linux + GPU**, une **instance cloud**, ou le mode **`hf`** sur une telle machine.
- **Hébergement** : Datalab propose une API managée (voir README upstream) — intégration différente (HTTP + clé), non câblée aujourd’hui dans `ocr_chandra.py`.
- **Erreurs** : vérifier que `VLLM_API_BASE` pointe bien vers le bon hôte/port et que `VLLM_MODEL_NAME` correspond à `curl .../v1/models`.

---

## 7. Licence et conformité

- Code **chandra-ocr** : Apache-2.0 (voir dépôt).
- **Poids du modèle** : conditions type OpenRAIL-M — à valider pour un usage commercial ; l’API Datalab peut simplifier l’aspect hébergement.

---

## 8. Tests automatisés

```bash
cd analyzer
python3 -m pip install -r requirements-dev.txt
python3 -m pytest tests/test_ocr_extract_engines.py -v
```

Les tests mockent Chandra / Tesseract : **pas besoin de GPU** en CI.

---

## 9. Références rapides

```bash
# Tesseract seul (défaut)
python3 ocr_extract.py --file doc.pdf

# Chandra (serveur vLLM déjà démarré sur localhost:8000)
export CHANDRA_METHOD=vllm
python3 ocr_extract.py --file doc.pdf --ocr-engine chandra

# Comparaison Tesseract vs Chandra, parsing aval sur le texte Tesseract
python3 ocr_extract.py --file doc.pdf --ocr-engine both --ocr-primary tesseract
```

Pour toute évolution du pipeline produit, voir aussi [`pouraccord_pipeline_analyse.md`](pouraccord_pipeline_analyse.md).
