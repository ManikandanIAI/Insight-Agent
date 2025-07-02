
# Targets
.PHONY: format

format :
	@for name in `find . -not -path "./.*" -name "*.py"`; do autopep8 -i $$name; echo Formating $$name; done
	@ echo "Code formated ..."