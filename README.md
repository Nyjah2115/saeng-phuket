# Saeng: strona koncepcyjna

Zwykła strona w HTML, CSS i JavaScript. Nie trzeba niczego instalować ani budować.

Na żywo: https://nyjah2115.github.io/saeng-phuket/

## Jak otworzyć

- Najprościej przez lokalny serwer: w tym folderze uruchom `python3 -m http.server 8000` i otwórz http://localhost:8000.
- Formularz prezentacji to wersja koncepcyjna: sprawdza pola i pokazuje podziękowanie, ale niczego nie wysyła. Przy prawdziwej stronie podłącz go np. do Formspree albo do WhatsAppa biura w `initForm` w `app.js`.

## Co gdzie jest

- `index.html`: treść strony
- `styles.css`: wygląd (czerń, złoto, Cormorant Garamond i Manrope)
- `app.js`: wybór piętra, przeloty kamery, karuzela udogodnień, kalkulator najmu i formularz
- `assets/picker`: budynek, salony i drugie pomieszczenia (wersje 2752 px i 1440 px)
- `assets/video`: przeloty kamery, wersja na komputer i na telefon (`-m`), bez dźwięku
- `assets/photos`: zdjęcia sekcji
- `404.html`: strona „Nie ma takiego piętra”

## Zmiana danych

Metraże, ceny w THB i liczba wolnych apartamentów są w `app.js` w tablicy `FLOORS`. Opisy apartamentów, drugich pomieszczeń i punkty w środku są w `ZONES`. Obrys pięter na zdjęciu budynku to `SLABS`. Kurs złotówki to `THB_TO_PLN`. Założenia kalkulatora (udział operatora, opłaty wspólne, domyślna cena za noc i obłożenie) są w `OPERATOR_SHARE`, `CAM_THB_PER_M2_MONTH` i `CALC`. Liczby panelu przy pierwszym wczytaniu (piętro 4) są też wpisane w `index.html`.

Wszystkie zdjęcia i filmy wygenerowano w Higgsfield. Budynek, ceny, stopy zwrotu i wizualizacje są fikcyjne.
