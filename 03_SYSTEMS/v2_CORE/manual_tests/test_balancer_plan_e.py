# -*- coding: utf-8 -*-
import unittest

class TestBalancerPlanEAndFixes(unittest.TestCase):
    def test_plan_e_and_key_sorting(self):
        # 1. ソートキーの一致チェック
        p1, p2, role = "Tamias", "Konpei", "JG"
        key_sorted = "<=>".join(sorted([p1, p2])) + ":" + role
        self.assertEqual(key_sorted, "Konpei<=>Tamias:JG")
        
        # 2. レート差判定のシビア化の検証
        def get_analysis_level(range_val):
            if range_val >= 500:
                return 'HIGH_DIFFERENCE'
            elif range_val < 250:
                return 'CLOSE'
            return 'STANDARD'

        self.assertEqual(get_analysis_level(520), 'HIGH_DIFFERENCE')
        self.assertEqual(get_analysis_level(200), 'CLOSE')
        self.assertEqual(get_analysis_level(350), 'STANDARD')

if __name__ == "__main__":
    unittest.main()
