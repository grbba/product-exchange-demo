from rdflib import Graph, Namespace, URIRef, SKOS, Literal

ttl = """
@prefix apmwg: <http://example.com/apmwg/> .
@prefix skos: <http://www.w3.org/2004/02/skos/core#> .

apmwg:G5K95028 a skos:Concept;
  skos:definition "A taste profile characterized by the presence of sugar or sweeteners, often found in desserts, candies, and certain beverages, appealing to the palate with a sugary flavor."@en;
  skos:inScheme apmwg:product_taxonomy_scheme;
  skos:prefLabel "Sweet"@en, "Sucré"@fr, "Süß"@de, "Dulce"@es;
  skos:broader apmwg:Z9H87109 .
"""

g = Graph().parse(data=ttl, format="turtle")
APMWG = Namespace("http://example.com/apmwg/")
c = URIRef(APMWG["G5K95028"])

labels = [(str(l), l.language) for l in g.objects(c, SKOS.prefLabel)]
definition = next(g.objects(c, SKOS.definition))
broader = next(g.objects(c, SKOS.broader))

print("Labels:", labels)
print("Definition (en):", definition)
print("Broader:", broader)
