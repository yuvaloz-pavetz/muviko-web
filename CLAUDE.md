# Muviko Web — Content & Publishing Standards

## Blog post quality standards

### Source requirements
Every blog post must be based on a study from a **high-impact, peer-reviewed journal**. Preferred journals (in rough priority order):

- **Tier 1 (ideal):** NEJM, JAMA (+ specialty journals: JAMA Oncology, JAMA Internal Medicine, JAMA Cardiology), The Lancet, Nature, Nature Medicine, BMJ, Cell
- **Tier 2 (good):** British Journal of Sports Medicine (BJSM), European Heart Journal, Circulation, Annals of Internal Medicine, PLOS Medicine, Sports Medicine
- **Tier 3 (acceptable):** Other indexed journals with IF > 5 — verify on PubMed before publishing

### Before writing any post
1. Find the **original primary study** on PubMed or the journal website — not a press release or secondary source
2. Verify: journal name, year, exact statistics, study population, and study design
3. Confirm the journal has a strong impact factor (check at [scimagojr.com](https://www.scimagojr.com) if unsure)
4. Pull the **DOI** and a direct link to the paper (PubMed or full-text URL)

### Every post must include
- Correct journal name, year, and author(s) in the meta and article header
- A visible "Read the study" link (PubMed or journal full-text) with the DOI
- Accurate statistics — do not round up or simplify in a way that changes the meaning
- Accurate description of the study population (who was studied matters)
- Accurate protocol description (what participants actually did)

### What to avoid
- Misattributing studies to the wrong journal or year
- Inflating effect sizes
- Describing a study's protocol inaccurately (e.g., saying "3× a day" when the actual protocol was different)
- Citing review articles or meta-analyses as if they were primary studies (flag if it's a meta-analysis)

## Post format
See existing articles in `/articles/` for the HTML template structure.
Each article needs a corresponding entry in `articles.json` with: date, slug, title, excerpt, source, image.
