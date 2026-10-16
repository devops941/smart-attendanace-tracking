# Test Images Directory

Place test photos here to test `compare_faces.py`:
1. `person1_a.jpg` - A clear front-facing photo of person 1 (e.g. your enrolled photo).
2. `person1_b.jpg` - A different photo or selfie of person 1 (under different lighting or angle).
3. `person2.jpg`   - A photo of a different person (e.g. friend or family member).

Run:
```powershell
python compare_faces.py test_images/person1_a.jpg test_images/person1_b.jpg
python compare_faces.py test_images/person1_a.jpg test_images/person2.jpg
```
