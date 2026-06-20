import math
from datetime import datetime, timedelta

# Standard FSRS v4 weights
DEFAULT_WEIGHTS = [
    0.4, 0.6, 2.4, 5.8,      # w0-w3 (initial stability for ratings 1-4)
    4.93, 0.94,              # w4 (initial difficulty), w5 (difficulty derivative)
    0.86, 0.01,              # w6 (difficulty derivative w.r.t rating), w7 (difficulty mean reversion weight)
    1.49, 0.14, 0.94,        # w8, w9, w10 (stability update factors)
    2.18, 0.05, 0.34, 1.26,  # w11, w12, w13, w14 (forgetting stability update parameters)
    0.26, 2.05               # w15 (easy bonus), w16 (hard penalty / interval modifier)
]

class FSRS:
    def __init__(self, weights=None, request_retrievability=0.9):
        self.w = weights or DEFAULT_WEIGHTS
        self.request_retrievability = request_retrievability

    def init_card_rating(self, rating: int):
        """
        Initialize stability and difficulty for a new card based on the rating.
        Rating: 1: Again, 2: Hard, 3: Good, 4: Easy
        """
        # S0(g) = w_{g-1}
        s = self.w[rating - 1]
        
        # D0(g) = w4 - (g - 3) * w5
        d = self.w[4] - (rating - 3) * self.w[5]
        d = max(1.0, min(10.0, d))
        
        # Initial states: Again -> Learning (1), others -> Review (2)
        state = 1 if rating == 1 else 2
        
        return s, d, state

    def update_card(self, rating: int, elapsed_days: float, s: float, d: float, state: int):
        """
        Update stability and difficulty for a card that has been reviewed before.
        """
        # Calculate current retrievability
        # R(t, S) = (1 + t / (9 * S))^-0.5
        retrievability = (1.0 + elapsed_days / (9.0 * s)) ** -0.5
        
        # Update difficulty
        # D_new = D - w6 * (g - 3)
        # D_new = w7 * D0(3) + (1 - w7) * D_new
        d_new = d - self.w[6] * (rating - 3)
        d_new = self.w[7] * self.w[4] + (1.0 - self.w[7]) * d_new
        d_new = max(1.0, min(10.0, d_new))
        
        # Update stability
        if rating == 1: # Again
            # S_forget = w11 * D^-w12 * (S + 1)^w13 * e^(w14 * (1 - R))
            s_new = self.w[11] * (d_new ** -self.w[12]) * ((s + 1) ** self.w[13]) * math.exp(self.w[14] * (1.0 - retrievability))
            new_state = 3 # Relearning
        else: # Hard, Good, Easy
            # S_recall = S * (1 + e^w8 * (11 - D_new) * S^-w9 * (e^(w10 * (1 - R)) - 1))
            hard_penalty = self.w[16] if rating == 2 else 1.0
            easy_bonus = self.w[15] if rating == 4 else 1.0
            
            factor = 1.0 + math.exp(self.w[8]) * (11.0 - d_new) * (s ** -self.w[9]) * (math.exp(self.w[10] * (1.0 - retrievability)) - 1.0)
            s_new = s * factor * hard_penalty * easy_bonus
            new_state = 2 # Review
            
        return s_new, d_new, new_state

    def calculate_interval(self, stability: float) -> int:
        """
        Calculate next interval in days.
        I = round(S * ln(R_desired) / ln(0.9))
        """
        interval = stability * math.log(self.request_retrievability) / math.log(0.9)
        return max(1, round(interval))

    def calculate_retrievability(self, last_review_date: datetime, current_date: datetime, stability: float) -> float:
        """
        Calculate retrievability R for memory replay health.
        """
        delta = current_date - last_review_date
        elapsed_days = max(0.0, delta.total_seconds() / (24 * 3600))
        return (1.0 + elapsed_days / (9.0 * stability)) ** -0.5
