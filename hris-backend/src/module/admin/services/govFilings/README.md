# Government Filing Artifacts

PH statutory filing outputs generated from posted payroll data.

```
aggregate.js            data layer — rolls up payslips/lines + gov IDs + statutory tables
formats/
  writers.js            low-level string shaping (money, TIN, delimiters, fixed-width)
  sssR3.js              SSS Contribution Collection List (R3)
  philhealthRF1.js      PhilHealth Employer Remittance Report (RF-1) — EPRS load file
  pagibigMCRF.js        Pag-IBIG Membership Contribution Remittance Form (MCRF)
  birAlphalist.js       BIR 1604-C Alphalist (.DAT + CSV mirror)
  bir2316.js            BIR 2316 certificate PDF (one page per employee)
  index.js              form key -> writer registry
```

Controller: `../../controller/payroll/GovFilingController.js`
Routes: `GET /payroll/gov-forms`, `/gov-forms/preview`, `/gov-forms/download`
Permission: `government-forms:view` (preview), `government-forms:generate` (download)

## Data flow

1. `aggregate.monthlyContributions(year, month)` / `annualCompensation(year)` sum
   `payroll.payslips` + `payslip_lines` for runs in `calculated|approved|paid`.
   - Monthly: payslips whose **pay period** intersects the month (both semi-monthly
     cutoffs → one full monthly contribution).
   - Annual: payslips whose **pay_date** falls in the calendar year.
2. Statutory bases (SSS MSC, PhilHealth premium base, Pag-IBIG comp) are
   reconstructed with `capSalary()` against the effective `payroll.statutory_tables`.
3. Each writer shapes those rows into the agency file.

## ⚠️ Spec accuracy

The electronic layouts below are **best-effort renderings of the published
specs**. Every agency revises them (often yearly) and their own validation tools
are the final authority. Always run the output through the agency's data-entry /
validation module before submitting.

| Form | Format implemented | Notes |
|------|-------------------|-------|
| SSS R3 | pipe-delimited `.txt` (`H`/`D`/`T` records) + CSV mirror | member EE/ER/EC shares; suffix not modelled |
| PhilHealth RF-1 | headerless CSV (EPRS member list) + labelled review CSV | `PIN,Last,First,Middle,Ext,MonthlyComp,PersonalShare,EmployerShare,Total` |
| Pag-IBIG MCRF | comma-delimited `.txt` (`H`/`D`/`T`) + CSV mirror | MID, TIN, monthly comp, EE/ER |
| BIR 1604-C Alphalist | comma-delimited `.DAT` (`H1604C`/`D<sched>`/`C1604C`) + per-schedule CSV | schedules 7.1 terminated / 7.2 subject to WT / 7.3 MWE / 7.4 exempt; ~20 of the form's ~40 detail fields are populated — **the DAT needs validation against the current BIR Alphalist Data Entry tool** |
| BIR 2316 | multi-page PDF (Parts I–IV), 1 employee/page; `?employee_id=` for one | readable rendering, not a pre-printed BIR form |

## Known gaps

- **Statutory rates** come from `payroll.statutory_tables`, currently seeded with
  labelled 2025 *placeholder* values. Set the correct schedule for the filing year
  first or every figure is wrong.
- **Prior-employer compensation** (mid-year hires) is not in the data model —
  `annualCompensation` warns when an employee has < 12 months of payroll.
- **De minimis** benefits are not separately tracked; the 2316 / Alphalist show
  ₱0 for that line and fold everything else into "13th month & other benefits" /
  non-taxable.
- **Name suffix** (Jr./Sr./III) is not a column on `employee.employees`.
- Alphalist Jan–Nov vs December tax-withheld split is approximated (all in Jan–Nov).
