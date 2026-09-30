/** System seed templates (§8.1 residential, §8.2 investment). */
import type { ContractTemplate } from "./templates";

export const RESIDENTIAL_TEMPLATE: ContractTemplate = {
  type: "residential",
  name: "عقد إيجار سكني",
  preamble: `عقد إيجار
انه في يوم {{day_name}} الموافق {{contract_date}}
تم الاتفاق بين كل من:
الطرف الأول: {{owner_name}}، المالك
ويحمل بطاقة مدنية رقم: {{owner_civil_id}}
الطرف الثاني: {{tenant_name}}، المستأجر
بطاقة مدنية: {{tenant_civil_id}}، تليفون: {{tenant_phones}}
حيث إن الطرف الأول يستغل {{property_description}} الرقم الآلي للعنوان {{property_paci}}
تم الاتفاق وذلك وفق الشروط التالية:`,
  closing: null,
  clauses: [
    { key: "unit", position: 1, body: "استأجر {{unit_type_label}} رقم {{unit_labels}} لاستعماله {{purpose}}." },
    {
      key: "rent",
      position: 2,
      body: "الإيجار الشهري المتفق عليه هو {{rent_amount}} دينار فقط {{rent_words}} دينار كويتي لا غير، تدفع في بداية كل شهر ميلادي.",
    },
    {
      key: "grace",
      position: 3,
      body: "يبدأ استحقاق الإيجار اعتبارًا من {{first_collection_date}}.",
      condition: "first_collection_date != start_date",
      optional: true,
      defaultEnabled: true,
    },
    {
      key: "term",
      position: 4,
      body: "مدة هذا العقد {{term_words}} تبدأ من {{start_date}} ويحق للطرف الثاني إخلاء العين المؤجرة بخطاب خطي قبلها ب{{notice_period_words}}.",
    },
    {
      key: "end",
      position: 5,
      body: "هذا العقد ينتهي بانتهاء المدة المذكورة في البند رقم ({{clause_ref:term}}) ما لم يوافق الطرفان على تجديده خطيًا.",
    },
    {
      key: "maintenance",
      position: 6,
      body: "يتعهد المستأجر بالمحافظة على سلامة ونظافة العين المؤجرة موضوع هذا العقد ويكون مسؤولًا عن كل ضرر فيه بما فيها التكييف والكهرباء والأدوات الصحية والأبواب والزجاج وغيرها ويتم تصليحه من حسابه الخاص.",
    },
    {
      key: "neighbors",
      position: 7,
      body: "يتعهد المستأجر بالمحافظة على علاقة حسن الجوار مع الآخرين وعدم عرقلة حركة المرور في العقار كله.",
    },
    {
      key: "utilities",
      position: 8,
      body: "دفع تأمين الكهرباء واستهلاك الكهرباء والماء من حساب {{utilities_party_label}} وحده.",
    },
    {
      key: "deposit",
      position: 9,
      body: "دفع الطرف الثاني مبلغ {{security_deposit_amount}} دينار ({{security_deposit_words}}) تأمينًا يرد عند انتهاء العقد وتسليم العين بحالتها بعد خصم أي مستحقات.",
      condition: "security_deposit_fils > 0",
    },
    {
      key: "no_changes",
      position: 10,
      body: "لا يحق للمستأجر أن يحدث أي تغيير أو وضع أي إعلان في العين المؤجرة إلا بموافقة خطية من المالك.",
    },
    {
      key: "no_assignment",
      position: 11,
      body: "لا يحق للمستأجر أن يتنازل عن كل أو بعض هذا العقد أو إدخال أي طرف آخر فيه إلا بالموافقة الخطية من المالك.",
    },
    { key: "jurisdiction", position: 12, body: "القضاء الكويتي هو الفصل في أي نزاع بين طرفي هذا العقد." },
    { key: "copies", position: 13, body: "حرر هذا العقد من نسختين وبين كل طرف نسخة منه." },
  ],
};

export const INVESTMENT_TEMPLATE: ContractTemplate = {
  type: "investment",
  name: "عقد إيجار استثماري",
  preamble: `عقد إيجار
انه في يوم {{day_name}} الموافق {{contract_date}}
تم الاتفاق بين كل من:
الطرف الأول: {{owner_name}}، المالك
ويحمل بطاقة مدنية رقم: {{owner_civil_id}}
الطرف الثاني: {{tenant_name}}، رقم مدني: {{tenant_civil_id}}
ت: {{tenant_phones}}
حيث إن الطرف الأول يستغل {{property_description}} الرقم الآلي للعنوان {{property_paci}}
فقد تم الاتفاق بين طرفي هذا العقد على ما يلي:`,
  closing: null,
  clauses: [
    {
      key: "unit",
      position: 1,
      body: "استأجر الطرف الثاني {{unit_type_label}} رقم {{unit_labels}}{{#unit_paci}} الرقم الآلي للمحل: {{unit_paci}}{{/unit_paci}}.",
    },
    {
      key: "inspection",
      position: 2,
      body: "أقر الطرف الثاني بأنه عاين العين موضوع هذا العقد المعاينة التامة النافية للجهالة وقبلها وأقر أنها صالحة لحاجته ومزاولة عمله.",
    },
    {
      key: "rent",
      position: 3,
      body: "استأجر الطرف الثاني {{unit_type_label}} نظير إيجار شهري قيمته {{rent_amount}} دينار كويتي فقط {{rent_words}} دينار كويتي لا غير تدفع في بداية كل شهر ميلادي.",
    },
    {
      key: "term",
      position: 4,
      body: "مدة هذا العقد {{term_words}} تبتدئ في: {{start_date}}{{#auto_renew}}، تجدد تلقائيًا.{{/auto_renew}}{{^auto_renew}} وتنتهي في {{end_date}}.{{/auto_renew}}{{#free_months}} وقد منح الطرف الثاني {{free_months_words}} مجانًا ويبدأ استحقاق الإيجار في {{first_collection_date}}، وفي حال رغبة الطرف الثاني إخلاء العين المؤجرة قبل مضي سنة واحدة فإنه ملزم بسداد قيمة الأشهر المجانية التي تم منحها له في بداية هذا العقد.{{/free_months}}",
    },
    {
      key: "purpose",
      position: 5,
      body: "أقر الطرف الثاني أنه استأجر العين موضوع هذا العقد لمزاولة: {{purpose}}، ولا يحق له تغيير هذا العمل إلا بالموافقة الخطية من الطرف الأول والجهات الرسمية.",
    },
    {
      key: "licenses",
      position: 6,
      body: "إن استخراج تراخيص مزاولة العمل لهذا العقد هي مسؤولية الطرف الثاني فقط ولا يتحمل الطرف الأول أية مسؤولية مادية أو أدبية إذا لم يتمكن المستأجر من الحصول عليها.",
    },
    {
      key: "utilities",
      position: 7,
      body: "{{#utilities_owner}}دفع تأمين الكهرباء واستهلاك الكهرباء والماء من حساب الطرف الأول فقط{{#electricity_fixed_amount}} وقيمة استهلاك الكهرباء {{electricity_fixed_amount}} دينار شهريًا، {{electricity_fixed_words}}{{/electricity_fixed_amount}}.{{/utilities_owner}}{{^utilities_owner}}دفع تأمين الكهرباء واستهلاك الكهرباء والماء من حساب الطرف الثاني وحده.{{/utilities_owner}}",
    },
    {
      key: "electric_load",
      position: 8,
      body: "لا يحق للطرف الثاني زيادة أحمال الكهرباء للمحل موضوع هذا العقد إلا بالموافقة الرسمية من وزارة الكهرباء مع تحمل الطرف الثاني جميع تكاليف زيادة هذه الأحمال من حسابه الخاص وحده.",
    },
    {
      key: "fresh_water",
      position: 9,
      body: "إذا رغب الطرف الثاني بتزويد العين موضوع هذا العقد بالماء العذب فإنه يتم الاتفاق على كمية وقيمة الاستهلاك شهريًا.",
    },
    {
      key: "industry_authority",
      position: 10,
      body: "في حال قررت الهيئة العامة للصناعة زيادة مبالغ مالية إيجارية على القسيمة فوق ما هو مقرر حين إبرام هذا العقد فإن الطرف الثاني قد وافق على أن يسدد ما يترتب عليه مقابل هذه الزيادة في حدود المساحة التأجيرية الخاصة به في هذا العقد.",
      optional: true,
      defaultCondition: "property_type == 'industrial'",
    },
    {
      key: "cleanliness",
      position: 11,
      body: "لا يحق للطرف الثاني وضع أي مواد أو بضائع أو مخلفات خارج حدود العين ويجب عليه المحافظة على النظافة العامة ومنطقة الخدمات والأدراج.",
    },
    {
      key: "fire_safety",
      position: 12,
      body: "لا يحق للطرف الثاني تخزين أية مواد قابلة للاشتعال داخل المحل أو خارجه ويلتزم بشروط الإدارة العامة للإطفاء ويتحمل وحده المسؤولية الكاملة عن مخالفة العقد.",
    },
    { key: "parking", position: 13, body: "لا يحق للطرف الثاني أن يستخدم مواقف سيارات المحلات الأخرى." },
    {
      key: "roof",
      position: 14,
      body: "لا يحق للطرف الثاني استخدام أسطح القسيمة للتخزين أو خلافه دون الرجوع للطرف الأول وموافقته خطيًا.",
    },
    {
      key: "signage",
      position: 15,
      body: "لا يحق للطرف الثاني تركيب الإعلان الخاص به إلا في المكان المخصص له فقط وأي زيادة يحق للمالك إزالتها.",
    },
    {
      key: "structure",
      position: 16,
      body: "يتعهد الطرف الثاني بعدم إزالة أو إضافة مبانٍ أو منشآت في المحل إلا بالموافقة الخطية من الطرف الأول والجهات الرسمية المختصة.",
    },
    {
      key: "neighbors",
      position: 17,
      body: "يتعهد الطرف الثاني بالمحافظة على حسن الجوار وممتلكات الآخرين والخدمات العامة.",
    },
    {
      key: "no_assignment",
      position: 18,
      body: "لا يحق للطرف الثاني التنازل عن هذا العقد أو جزء منه أو إدخال طرف آخر به إلا بالموافقة الخطية من الطرف الأول.",
    },
    {
      key: "handover",
      position: 19,
      body: "في حال ترك الطرف الثاني المحل موضوع هذا العقد أو فسخه فإنه يتعهد أن يعيده كما كان حين استلمه.",
    },
    {
      key: "amendments",
      position: 20,
      body: "كل تغيير بهذا العقد وشروطه لا يعتد به إلا بالموافقة الخطية من الطرف الأول ويعتبر هذا العقد ملغيًا في حال مخالفة الطرف الثاني لأي من بنوده والتزاماته التعاقدية.",
    },
    {
      key: "termination_notice",
      position: 21,
      body: "إذا رغب الطرف الثاني في فسخ هذا العقد فيجب عليه إبلاغ الطرف الأول خطيًا وقبل {{notice_period_words}} من فسخ العقد.",
    },
    {
      key: "address",
      position: 22,
      body: "عنوان المراسلة لطرفي هذا العقد هو المسجل في البطاقة المدنية لكل منهما.",
    },
    {
      key: "annex",
      position: 23,
      body: "البنود التي لم يرد ذكرها في هذا العقد يتم التفاهم عليها في عقد ملحق لهذا العقد ويوقع من طرفي هذا العقد.",
    },
    { key: "jurisdiction", position: 24, body: "محاكم الكويت هي الفصل في أي نزاع قد ينشأ لا قدر الله." },
    {
      key: "no_worker_housing",
      position: 25,
      body: "سكن العمال وغيرهم ومبيتهم غير مسموح به بتاتًا في القسيمة موضوع هذا العقد.",
    },
  ],
};

export const SEED_TEMPLATES = [RESIDENTIAL_TEMPLATE, INVESTMENT_TEMPLATE] as const;
