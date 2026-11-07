import csv
import io
import re
from uuid import uuid4

from openpyxl import load_workbook

from .models import Subscription

ALIASES = {
    "name": {"service", "subscription", "subscriptionname", "servicename", "name", "vendor", "app", "application", "product", "supplier"},
    "users": {"users", "activeusers", "numberofusers", "usercount", "seatsused", "usage"},
    "spend": {"spend", "currentspend", "monthlyspend", "monthlycost", "cost", "amount", "price"},
    "currency": {"currency", "currencycode"},
    "category": {"category", "type", "department"},
    "period": {"period", "billingperiod", "billingcycle", "frequency"},
}


def normalise(value):
    return re.sub(r"[^a-z0-9]", "", str(value).lower())


def number(value):
    if value is None or str(value).strip().lower() in {"", "n/a", "na", "unknown", "-"}:
        return None
    cleaned = re.sub(r"[£$€,\s]", "", str(value))
    result = float(cleaned)
    if result < 0:
        raise ValueError("Negative values are not supported")
    return result


def parse_file(filename: str, data: bytes) -> tuple[list[Subscription], list[str]]:
    if filename.lower().endswith(".xlsx"):
        workbook = load_workbook(io.BytesIO(data), read_only=True, data_only=True)
        sheets = [(sheet.title, list(sheet.iter_rows(values_only=True))) for sheet in workbook]
        workbook.close()
    elif filename.lower().endswith(".csv"):
        text = data.decode("utf-8-sig")
        try:
            dialect = csv.Sniffer().sniff(text[:8192], delimiters=",;\t")
        except csv.Error:
            dialect = csv.excel
        sheets = [(filename, list(csv.reader(io.StringIO(text), dialect)))]
    else:
        raise ValueError("Please upload a CSV or XLSX file")
    services, warnings = [], []
    for sheet_name, rows in sheets:
        mapping, header = {}, -1
        for i, row in enumerate(rows[:25]):
            candidate = {field: index for index, value in enumerate(row)
                         for field, aliases in ALIASES.items() if normalise(value) in aliases}
            if "name" in candidate:
                mapping, header = candidate, i
                break
        if header < 0:
            warnings.append(f"{sheet_name}: no service-name column found. Try 'Service' or 'Subscription name'.")
            continue
        for line, row in enumerate(rows[header + 1:], start=header + 2):
            def cell(field):
                index = mapping.get(field)
                return row[index] if index is not None and index < len(row) else None
            name = str(cell("name") or "").strip()
            if not name:
                continue
            try:
                users, spend = number(cell("users")), number(cell("spend"))
                if users is not None and not users.is_integer():
                    raise ValueError("User counts must be whole numbers")
                if normalise(cell("period")) in {"annual", "annually", "year", "yearly"} and spend is not None:
                    spend /= 12
                currency = str(cell("currency") or "GBP").strip().upper()
                if currency not in {"GBP", "USD", "EUR"}:
                    raise ValueError("Currency must be GBP, USD or EUR")
                services.append(Subscription(id=uuid4().hex, name=name[:200], users=users,
                    user_source="Manual" if users is not None else None, spend=spend,
                    currency=currency, category=str(cell("category") or "Other")[:100]))
            except (ValueError, TypeError) as exc:
                warnings.append(f"{sheet_name}, row {line} ({name}): {exc}")
    if len(services) > 500:
        raise ValueError("Please upload at most 500 services at a time")
    return services, warnings
