# CV Project

## Business Requirements

- Build a Professional Website
- It should include about me, my career journey, links to a portfolio (for future).
- Input data in `sources` directory:
  - `linkedin.pdf`: my linkedin profile in PDF format
  - `resume-references.pdf`: detailing my telecom project experience
  - `cv_anemet.pdf`: a more recent CV including my space technologies interest/studies
  - `42transcript.pdf`: my current studies at school 42 
    - **note1**: the line
    "Attila Nemet : Common core achieved at: 87%" is a mistake, the actual percentage is **98%** - only the CV project is missing from the common core, and this CV site shows that I am capable of doing it. Please use the **98%** figure on the website.
    - **note2**: currently I'm doing AI and Cybersecurity specialization projects at school 42 and additionally I am doing in parallel the [DLH Cybersecurity Academy](https://www.dlh.lu/cs-academy), which is a 12-month intensive training program in cybersecurity. Please update the website with this information as well.
  - `*_Motivation.pdf`: motivation letters for various applications, which shows my diverese interests on different fields and my motivation to learn and grow.
  - `Letter.of.Rec_SnT_JQuerol.pdf`: letter of recommendation from my professor at the University of Luxembourg
  - `staats_exam_A1.pdf`: exam certificate allowing me to get Luxembourgish government jobs (done in French)
- Make the website stunning:
  - Enterprise meets edgy
  - Use a modern design with a clean layout and intuitive navigation.
  - Ensure the website is responsive and looks great on all devices (desktop, tablet, mobile).
  - Incorporate interactive elements to engage visitors, such as animations or hover effects.
  - Use high-quality images and graphics to enhance the visual appeal.
  - Implement a consistent color scheme and typography that reflects professionalism.
- The website should be easy to maintain and update, allowing me to add new content or make changes without requiring extensive technical knowledge.

## Technical Details

- Implemented as a modern NextJS app, client rendered
- The NextJS app should be created in a subdirectory `web`
- No persistence
- No user management for the MVP
- Use popular libraries
- As simple as possible but with an elegant UI

## Color Scheme

- Accent Yellow: `#ecad0a` - accent lines, highlights
- Blue Primary: `#209dd7` - links, key sections
- Purple Secondary: `#753991` - submit buttons, important actions
- Dark Navy: `#032147` - main headings
- Gray Text: `#888888` - supporting text, labels

## Coding standards

1. Use latest versions of libraries and idiomatic approaches as of today
2. Keep it simple - NEVER over-engineer, ALWAYS simplify, NO unnecessary defensive programming. No extra features - focus on simplicity.
3. Be concise. Keep README minimal. 
