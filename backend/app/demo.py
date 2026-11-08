from uuid import uuid4

from . import db
from .models import Subscription, Tier

DEMO = [
    ("Notion", "Productivity", 42, 950, 10, 18),
    ("Figma", "Design", 12, 720, 15, 45),
    ("GitHub", "Development", 86, 1806, 4, 21),
    ("JSTOR", "Research", None, 850, 120, 550),
    ("Financial Times", "News", 18, None, 29, 55),
    ("Slack", "Productivity", 120, 960, 8, 15),
    ("Miro", "Design", None, 640, 8, 16),
    ("Zoom", "Productivity", 24, 600, 13, 18),
]


def seed(workspace_id: str = "default"):
    for name, category, users, spend, basic, pro in DEMO:
        service = Subscription(id=uuid4().hex, name=name, category=category, users=users, workspace_id=workspace_id,
            user_source="Manual" if users is not None else None, spend=spend, demo=True,
            tiers=[Tier(name="Team", monthly_price=basic, per_user=True,
                        description="Illustrative demo pricing per user/month; not a vendor quote."),
                   Tier(name="Business", monthly_price=pro, per_user=True,
                        description="Illustrative demo pricing per user/month; not a vendor quote."),
                   Tier(name="Business", monthly_price=round(pro * .8, 2), per_user=True,
                        billing_period="annual", description="Annual team licence, paid yearly."),
                   Tier(name="Enterprise", billing_period="annual", description="Custom pricing. Contact sales.")])
        db.save(service)
        db.enqueue(service.id)
