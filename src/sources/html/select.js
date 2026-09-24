'use strict';

/**
 * Field syntax: 'selector' reads the text, 'selector@attr' an attribute and
 * '@attr' an attribute of the scope itself. Missing values come back as null.
 */
function readField($scope, field) {
  const [selector, attr] = field.split('@');
  const $node = selector.trim() ? $scope.find(selector.trim()).first() : $scope;
  if (!$node.length) return null;

  const value = attr ? $node.attr(attr) : $node.text();
  return value?.trim() || null;
}

const readFields = ($scope, fields) =>
  Object.fromEntries(Object.entries(fields).map(([name, field]) => [name, readField($scope, field)]));

module.exports = { readFields };
