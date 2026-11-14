# Data rules

- Every number on screen or in an assistant answer comes from checked data files. Never type a number or a claim into code or text.
- Coverage claims are computed and scoped, for example "in the PSI data loaded".
- Convert pressure to psi and oxygen to % by volume in clean data. Keep the original units in the raw files.
- data/incoming is read-only. Never edit teammates' files. Scripts write cleaned files to data/clean.
- Missing values stay null and show as "not reported". Never guess.
- A record that fails validation is reported, not silently fixed.
- Experiments not yet received show as "not loaded".
- The lunar zone values live in one place only.
- Planned or outside-PSI experiments (SoFIE, FM2, Saffire IV to VI) are labelled as such, with no numbers shown as fact.
