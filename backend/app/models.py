from typing import Literal

from pydantic import BaseModel, Field


class Tier(BaseModel):
    name: str
    min_users: int = Field(default=0, ge=0)
    max_users: int | None = Field(default=None, ge=0)
    monthly_price: float | None = Field(default=None, ge=0)
    per_user: bool = False
    minimum_seats: int = Field(default=1, ge=1)
    currency: str = "GBP"
    description: str
    source_url: str = ""


class Subscription(BaseModel):
    id: str
    name: str
    users: int | None = Field(default=None, ge=0, le=10000000)
    user_source: Literal["Manual", "SSO"] | None = None
    spend: float | None = Field(default=None, ge=0)
    currency: str = "GBP"
    category: str = "Other"
    status: str = "queued"
    tiers: list[Tier] = []
    suggested_tier: str | None = None
    optimal_spend: float | None = None
    savings: float | None = None
    explanation: str = ""
    error: str | None = None
    demo: bool = False
    researched_at: str | None = None
    sso_checked_at: str | None = None
    events: list[str] = []


class EditSubscription(BaseModel):
    users: int | None = Field(default=None, ge=0, le=10000000)
    spend: float | None = Field(default=None, ge=0)


class Filters(BaseModel):
    query: str = ""
    category: str = "All"
    status: str = "All"
    savings_only: bool = False
