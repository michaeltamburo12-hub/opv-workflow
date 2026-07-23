#!/usr/bin/env python3
"""
PCRE Lease Comp PDF parser using pdfplumber.
Usage: python3 parse_lease_comps.py <pdf_path>
Outputs JSON to stdout: {"type": "lease_comps", "headers": [...], "rows": [...]}
or {"type": "unknown"} if file doesn't match the expected format.
"""
import sys, json, re

def parse_money(s):
    if not s: return ''
    m = re.search(r'[\d,]+(?:\.\d+)?', str(s).replace(',', ''))
    return m.group(0) if m else ''

def parse_date(s):
    if not s: return ''
    s = str(s).strip()
    m = re.match(r'(\d{1,2})/(\d{1,2})/(\d{4})', s)
    if m:
        return f"{m.group(3)}-{m.group(1).zfill(2)}-{m.group(2).zfill(2)}"
    m = re.match(r'Q([1-4])\s*(\d{2})', s, re.I)
    if m:
        q = {'1': '01', '2': '04', '3': '07', '4': '10'}
        return f"20{m.group(2)}-{q[m.group(1)]}-01"
    return ''

def extract_first_num(s):
    if not s: return ''
    m = re.search(r'\d+(?:\.\d+)?', str(s).replace(',', ''))
    return m.group(0) if m else ''

def main():
    if len(sys.argv) < 2:
        print(json.dumps({"type": "unknown", "error": "No PDF path provided"}))
        sys.exit(0)

    pdf_path = sys.argv[1]

    try:
        import pdfplumber
    except ImportError:
        print(json.dumps({"type": "unknown", "error": "pdfplumber not installed"}))
        sys.exit(0)

    try:
        records = []
        with pdfplumber.open(pdf_path) as pdf:
            for page in pdf.pages:
                table = page.extract_table()
                if not table:
                    continue

                # Detect lease comp format: find the Transaction Date header row
                header_idx = None
                for i, row in enumerate(table):
                    if row and str(row[0]).strip() == 'Transaction Date':
                        header_idx = i
                        break

                if header_idx is None:
                    continue

                # Verify this has "Deal Rent" column (col 10)
                header_row = table[header_idx]
                if len(header_row) < 11 or 'Deal Rent' not in str(header_row[10]):
                    continue

                # Parse data rows
                for row in table[header_idx + 1:]:
                    while len(row) < 19:
                        row.append('')
                    row = [str(c).strip().replace('\n', ' ') if c else '' for c in row]

                    county = row[3].strip()
                    if county not in ('Nassau', 'Suffolk'):
                        continue

                    # Ceiling height: extract numeric part
                    ceil_raw = row[6].replace('\n', ' ').strip()
                    ceil_m = re.search(r'(\d+(?:\.\d+)?)', ceil_raw)
                    ceil_val = ceil_m.group(1) if ceil_m else ''

                    # Lease term: handle "5 years plus 5 years option", "5-10", etc.
                    lt = row[13].strip()
                    lt_m = re.match(r'(\d+)', lt)
                    lease_term = lt_m.group(1) if lt_m else ''

                    # Building SF: strip commas, get first number
                    bsf_val = extract_first_num(row[4])

                    # Lot size: skip N/A
                    lot = '' if row[5].strip() in ('', 'N/A') else row[5].strip()

                    # Mgmt fee: strip %
                    mgmt = row[16].replace('%', '').strip() if row[16] else ''

                    rec = {
                        'transaction_date': parse_date(row[0]),
                        'address': row[1].replace('\n', ' ').strip().rstrip(','),
                        'town': row[2].replace('\n', ' ').strip(),
                        'county': county,
                        'building_sf': bsf_val,
                        'lot_size_ac': lot,
                        'ceiling_height': ceil_val,
                        'loading_docks': row[7].strip(),
                        'drive_ins': row[8].strip(),
                        'asking_rent': parse_money(row[9]),
                        'deal_rent': parse_money(row[10]),
                        'rent_type': row[11].strip(),
                        'taxes': parse_money(row[12]),
                        'lease_term_years': lease_term,
                        'rent_concession_months': row[14].strip(),
                        'ti_ll_work': parse_money(row[15]),
                        'mgmt_fee_pct': mgmt,
                        'tenant': row[17].replace('\n', ' ').strip(),
                        'landlord': row[18].replace('\n', ' ').strip(),
                        'status': 'Active',
                    }
                    records.append(rec)

        if not records:
            print(json.dumps({"type": "unknown"}))
        else:
            headers = list(records[0].keys())
            print(json.dumps({"type": "lease_comps", "headers": headers, "rows": records}))

    except Exception as e:
        print(json.dumps({"type": "unknown", "error": str(e)}))

if __name__ == '__main__':
    main()
