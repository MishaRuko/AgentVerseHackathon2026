from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, model_validator

BillingPeriod = Literal["monthly", "annual", "unspecified"]


class Tier(BaseModel):
    model_config = ConfigDict(allow_inf_nan=False)
    name: str
    min_users: int = Field(default=0, ge=0)
    max_users: int | None = Field(default=None, ge=0)
    monthly_price: float | None = Field(default=None, ge=0)
    per_user: bool = False
    minimum_seats: int = Field(default=1, ge=1)
    currency: str = "GBP"
    description: str
    source_url: str = ""
    estimated: bool = False
    billing_period: BillingPeriod = "unspecified"

    @model_validator(mode="before")
    @classmethod
    def infer_legacy_period(cls, data):
        if isinstance(data, dict) and "billing_period" not in data:
            text = str(data.get("description", "")).lower()
            period = "annual" if any(s in text for s in ("annually", "annual", "year")) else "monthly" if "month" in text else "unspecified"
            data = {**data, "billing_period": period}
        return data


class Recommendation(BaseModel):
    billing_period: BillingPeriod
    tier_name: str
    tier_index: int
    monthly_cost: float
    annual_cost: float
    monthly_savings: float | None = None
    annual_savings: float | None = None


class Metadata(BaseModel):
    category: Literal["Productivity", "Research", "News", "Design", "Development", "Other"]
    description: str
    tags: list[str] = []
    website: str = ""


class Subscription(BaseModel):
    model_config = ConfigDict(allow_inf_nan=False)
    id: str
    name: str
    workspace_id: str = "default"
    users: int | None = Field(default=None, ge=0, le=10000000)
    user_source: Literal["Manual", "SSO"] | None = None
    spend: float | None = Field(default=None, ge=0)
    currency: str = "GBP"
    category: str = "Other"
    description: str = ""
    tags: list[str] = []
    website: str = ""
    metadata_researched_at: str | None = None
    status: str = "queued"
    tiers: list[Tier] = []
    suggested_tier: str | None = None
    suggested_billing_period: BillingPeriod | None = None
    recommendations: list[Recommendation] = []
    optimal_spend: float | None = None
    savings: float | None = None
    explanation: str = ""
    error: str | None = None
    demo: bool = False
    researched_at: str | None = None
    sso_checked_at: str | None = None
    analysed_at: str | None = None
    events: list[str] = []


class EditSubscription(BaseModel):
    model_config = ConfigDict(allow_inf_nan=False)
    users: int | None = Field(default=None, ge=0, le=10000000)
    spend: float | None = Field(default=None, ge=0)


class Filters(BaseModel):
    model_config = ConfigDict(allow_inf_nan=False)
    query: str = ""
    category: str = "All"
    status: str = "All"
    savings_only: bool = False
    min_users: int | None = Field(default=None, ge=0)
    max_users: int | None = Field(default=None, ge=0)
    min_spend: float | None = Field(default=None, ge=0)
    max_spend: float | None = Field(default=None, ge=0)
    min_savings: float | None = Field(default=None, ge=0)
    user_source: Literal["All", "SSO", "Manual", "Missing"] = "All"
    currency: Literal["All", "GBP", "USD", "EUR"] = "All"
