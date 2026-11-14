# Data folders

- `incoming/experiments/` experiment JSON records from teammates.
- `incoming/test-tables/` test-table CSV files from teammates.
- `incoming/documents/` PDF reports. Large, so git-ignored (only `.gitkeep` is tracked).
- `clean/` cleaned files written by scripts. Pressure in psi, oxygen in % by volume.

`data/incoming` is read-only. Never edit, rename or delete teammates' files. This is a convention, not a file permission. Scripts write only to `data/clean`.
