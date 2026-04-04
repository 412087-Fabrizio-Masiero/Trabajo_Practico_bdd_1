#!/bin/bash

# Script para cargar 200 productos en Redis usando redis-cli
# Esto es más confiable que ioredis desde Windows -> WSL

# Arrays para generar datos
CATEGORIES=("analgesicos" "antibioticos" "antinflamatorios" "dermocosmetica" "gastrointestinal" "cardiovascular" "respiratorio" "vitaminas" "suplementos" "cuidado-personal" "oftalmico" "otorrinolaringologia" "femenino" "pediatrico" "dieteticos")

LABORATORIES=("Bayer" "Novartis" "Pfizer" "Roche" "GSK" "Sanofi" "Merck" "Johnson Johnson" "Abbott" "BMS" "AstraZeneca" "Eli Lilly" "Boehringer" "Takeda" "Teva")

# Nombres por categoría
declare -A PRODUCTS_BY_CAT
PRODUCTS_BY_CAT[analgesicos]="Paracetamol500 Paracetamol1g Ibuprofeno400 Ibuprofeno600 Aspirina500 Dipirona500 Naproxeno500 Tramadol50 Codeina30 Morfina10 Ketoprofeno50 Diclofenaco50"
PRODUCTS_BY_CAT[antibioticos]="Amoxicilina500 Amoxicilina875 Azitromicina500 Ciprofloxacino500 Ceftriaxona1g Cefalexina500 Metronidazol500 Doxiciclina100 Levofloxacino500 PenicilinaV500 Sulfametoxazol800 Eritromicina500"
PRODUCTS_BY_CAT[antiinflamatorios]="Ibuprofeno400 Ibuprofeno600 Naproxeno500 Ketoprofeno50 Diclofenaco50 DiclofenacoGel Piroxicam20 Meloxicam15 Celecoxib200 Etoricoxib90"
PRODUCTS_BY_CAT[dermocosmetica]="CremaHydratante ProtectorSolar50 CremaAntiarugas TratamientoAcne SerumVitC CremaOjos GelLimpiador TonicoMascarilla BalsamoLabial CremaManos LocionCorporal"
PRODUCTS_BY_CAT[gastrointestinal]="Omeprazol20 Omeprazol40 Pantoprazol40 Esomeprazol20 Ranitidina150 Famotidina20 Metoclopramida10 Domperidona10 Loperamida2 Simeticona125 Buscapina10 Enantyum25"
PRODUCTS_BY_CAT[cardiovascular]="Losartan50 Losartan100 Amlodipino5 Amlodipino10 Enalapril10 Captopril25 Hidroclorotiazida25 Furosemida40 Atorvastatina20 Atorvastatina40 Simvastatina20 Rosuvastatina10"
PRODUCTS_BY_CAT[respiratorio]="Salbutamol100 Budesonida100 Fluticasona125 Cetirizina10 Loratadina10 Desloratadina5 Ambroxol30 AmbroxolJarabe Carbocisteina375 Pseudoefedrina60 Fenilefrina10 Dextrometorfano15"
PRODUCTS_BY_CAT[vitaminas]="VitaminaC1000 VitaminaD3_1000 VitaminaD3_4000 VitaminaB12_1000 VitaminaB1_100 VitaminaBComplex VitaminaE400 VitaminaK2_100 AcidoFolico5 Multivitaminico FerroGlubionate Magnesio300"
PRODUCTS_BY_CAT[suplementos]="Omega3_1000 Omega3_2000 Glucosamina1500 Condroitina1200 Creatina5g Magnesio300 Zinc50 Selenio200 CoQ10 Melatonina1 Melatonina3 GinkgoBiloba80 Spirulina1000"
PRODUCTS_BY_CAT[cuidado-personal]="ShampooMedicinal Acondicionador JabonAntibacterial CremaDental EnjuagueBucal CepilloDental Algodon Gasas Vendas Curitas RepelenteInsectos"
PRODUCTS_BY_CAT[oftalmico]="LagrimasArtificiales GotasLubricantes SolucionLentes TobramicinaGotas PolimixinaB_Gotas DexametasonaGotas TetrizolinaGotas OlopatadinaGotas"
PRODUCTS_BY_CAT[otorrinolaringologia]="SprayNasalFisiologic SprayNasalDescongestivo GotasOticas AguaOxigenada GlicerinaBoratada SprayGarganta"
PRODUCTS_BY_CAT[femenino]="AnticonceptivosOrales Progesterona200 AcidoFolico5 SuplementoPrenatal CremaEstrogenica TratamientoCandidiasis TestEmbarazo Preservativos GelLubricante"
PRODUCTS_BY_CAT[pediatrico]="ParacetamolPediatric IbuprofenoPediatric AmoxicilinaSuspension AzitromicinaSuspension VitaminaD3_Pediatric MultivitaminicoPediatric SueroOral Rehidratante CremaPanal"
PRODUCTS_BY_CAT[dieteticos]="Edulcorante BarraProteinica BebidaIsotonica SustitutoComida FibraAlimentaria Probioticos"

echo "🔄 Generando y cargando 200 productos en Redis..."

COUNT=0
LOW_STOCK=0

for cat in "${CATEGORIES[@]}"; do
    products=(${PRODUCTS_BY_CAT[$cat]})
    products_per_cat=14
    
    for i in $(seq 1 $products_per_cat); do
        if [ $COUNT -ge 200 ]; then
            break
        fi
        
        # Generar datos
        idx=$((i - 1))
        name="${products[$idx]}"
        if [ -z "$name" ]; then
            name="${cat}${i}"
        fi
        
        code="${cat:0:3}$(printf '%04d' $((COUNT + 1)))"
        price=$(awk -v min=5 -v max=150 'BEGIN{srand(); print int(rand()*(max-min)+min)}')
        min_stock=$(awk -v min=5 -v max=15 'BEGIN{srand(); print int(rand()*(max-min)+min)}')
        stock=$(awk -v min=0 -v max=100 'BEGIN{srand(); print int(rand()*(max-min)+min)}')
        
        # 15% probabilidad de stock bajo
        if [ $(awk -v min=0 -v max=100 'BEGIN{srand(); print int(rand()*100)}') -lt 15 ]; then
            stock=$(awk -v ms=$min_stock 'BEGIN{srand(); print int(rand()*ms)}')
            LOW_STOCK=$((LOW_STOCK + 1))
        fi
        
        # Fecha de vencimiento (30 días a 2 años)
        days=$(awk -v min=30 -v max=730 'BEGIN{srand(); print int(rand()*(max-min)+min)}')
        expiry_date=$(date -d "+${days} days" +%Y-%m-%d 2>/dev/null || powershell -Command "(Get-Date).AddDays(${days}).ToString('yyyy-MM-dd')")
        
        lab_idx=$(awk -v max=15 'BEGIN{srand(); print int(rand()*max)}')
        laboratory="${LABORATORIES[$lab_idx]}"
        
        # Cargar en Redis usando HASH
        redis-cli HSET "product:${code}" \
            code "$code" \
            name "$name" \
            category "$cat" \
            price "$price" \
            stock "$stock" \
            minStock "$min_stock" \
            expiryDate "$expiry_date" \
            description "$name de $laboratory" \
            laboratory "$laboratory" \
            batchNumber "LOT$((RANDOM % 900000 + 100000))" \
            createdAt "$(date +%s)000" > /dev/null
        
        # Agregar a índices
        redis-cli SADD "all_products" "$code" > /dev/null
        redis-cli SADD "categories" "$cat" > /dev/null
        redis-cli SADD "products_by_category:${cat}" "$code" > /dev/null
        
        # Agregar a sorted set de vencimiento
        expiry_ts=$(date -d "$expiry_date" +%s 2>/dev/null || powershell -Command "[System.DateTime]::Parse('$expiry_date').Subtract([System.DateTime]::1970,1,1,0,0,0,0).TotalSeconds * 1000")
        redis-cli ZADD "expiring_products" "$expiry_ts" "$code" > /dev/null
        
        COUNT=$((COUNT + 1))
        
        if [ $((COUNT % 50)) -eq 0 ]; then
            echo "   ... $COUNT productos cargados"
        fi
    done
done

echo ""
echo "✅ $COUNT productos cargados"
echo "⚠️  $LOW_STOCK productos con stock bajo"

# Verificar
total=$(redis-cli SCARD all_products)
categories=$(redis-cli SCARD categories)
echo ""
echo "📋 Verificación:"
echo "   - Total productos: $total"
echo "   - Categorías: $categories"
echo ""
echo "✅ Carga completada"
