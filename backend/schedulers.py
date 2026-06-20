import math

class SM2:
    @staticmethod
    def init_card_rating(rating: int):
        """
        Initialize card for SM-2.
        Rating: 1: Again, 2: Hard, 3: Good, 4: Easy
        Returns: (interval_days, ease_factor, repetitions)
        """
        if rating == 1: # Again
            return 1, 2.5, 0
        elif rating == 2: # Hard
            return 1, 2.5, 1
        elif rating == 3: # Good
            return 1, 2.5, 1
        else: # Easy
            return 4, 2.6, 1

    @staticmethod
    def update_card(rating: int, prev_interval: int, prev_ease: float, prev_reps: int):
        """
        Update card parameters for SM-2 on review.
        Returns: (interval_days, ease_factor, repetitions)
        """
        # Map 1-4 rating to quality q (0-5) for classic SM-2 formula:
        if rating == 1: # Again
            q = 1
        elif rating == 2: # Hard
            q = 3
        elif rating == 3: # Good
            q = 4
        else: # Easy
            q = 5

        # Update Ease Factor
        ef_change = 0.1 - (5 - q) * (0.08 + (5 - q) * 0.02)
        ease_factor = max(1.3, prev_ease + ef_change)

        if rating == 1: # Again
            repetitions = 0
            interval = 1
        else:
            repetitions = prev_reps + 1
            if repetitions == 1:
                interval = 1
            elif repetitions == 2:
                interval = 6
            else:
                interval = max(1, round(prev_interval * prev_ease))
                if rating == 2: # Hard penalty
                    interval = max(1, round(prev_interval * 1.2))
                elif rating == 4: # Easy bonus
                    interval = max(1, round(prev_interval * prev_ease * 1.3))

        return interval, ease_factor, repetitions


class Leitner:
    BOX_INTERVALS = {
        1: 1,
        2: 3,
        3: 7,
        4: 14,
        5: 30
    }

    @staticmethod
    def init_card_rating(rating: int):
        """
        Initialize card for Leitner.
        Returns: (interval_days, box_number)
        """
        if rating == 1: # Again
            return Leitner.BOX_INTERVALS[1], 1
        elif rating == 2: # Hard
            return Leitner.BOX_INTERVALS[1], 1
        elif rating == 3: # Good
            return Leitner.BOX_INTERVALS[2], 2
        else: # Easy
            return Leitner.BOX_INTERVALS[3], 3

    @staticmethod
    def update_card(rating: int, prev_box: int):
        """
        Update box number and interval for Leitner on review.
        Returns: (interval_days, new_box_number)
        """
        if rating == 1: # Again (failed) -> Reset to Box 1
            new_box = 1
        elif rating == 2: # Hard -> Keep in current box
            new_box = prev_box
        elif rating == 3: # Good -> Move up 1 box
            new_box = min(5, prev_box + 1)
        else: # Easy -> Move up 2 boxes
            new_box = min(5, prev_box + 2)

        return Leitner.BOX_INTERVALS[new_box], new_box


def format_interval(days: float) -> str:
    """
    Formats day intervals into human readable format matching Anki (e.g. 10m, 2d, 1.5mo).
    """
    if days <= 0:
        return "0d"
    
    if days < 1:
        minutes = round(days * 24 * 60)
        if minutes < 60:
            return f"{minutes}m"
        else:
            return f"{round(days * 24)}h"
            
    days_int = round(days)
    if days_int >= 30:
        months = days_int / 30.0
        if months < 12:
            return f"{months:.1f}mo" if months % 1 != 0 else f"{int(months)}mo"
        else:
            years = days_int / 365.0
            return f"{years:.1f}y" if years % 1 != 0 else f"{int(years)}y"
            
    return f"{days_int}d"
